/*
    callin.js
    author: masatoshi teruya
    email: mah0x211@gmail.com
    copyright (C) 2011, masatoshi teruya. all rights reserved.
    
    CREATE CALLER:
        var callin = new callin( delegator );
                    
    ADDING ROUTING TABLE
        router.set( routing_table_format:Object );

        ROUTING TABLE FORMAT:
        {
            "/path/to/url1": {
                "method1": "args",
                "method2": ["args"],
                "method3": { "arg": val },
                ...
            },
            "/path/to/url2": {
                "method1": "args",
                "method2": ["args"],
                "method3": { "arg": val },
                ...
            },
            ...
        }
    
    CALL:
        router.calling( '/path/to/uri1':String, use_process.nextTick:Boolean, your_context:Object, callback:Function );
            if found directive for route:'/path/to/uri1'
                if defined function delegate.method1
                    delegate.method1( your_context, method:Object, runNext:Function, use_process.nextTick:Boolean );
                else
                    check next uri
            else
                callback()
*/
var SIGNAMES = [
        'SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 
        'SIGTRAP', 'SIGABRT', 'SIGEMT', 'SIGFPE', 
        'SIGKILL', 'SIGBUS', 'SIGSEGV', 'SIGSYS', 
        'SIGPIPE', 'SIGALRM', 'SIGTERM', 'SIGURG', 
        'SIGTSTP', 'SIGCONT', 'SIGCHLD', 'SIGTTIN', 
        'SIGTTOU', 'SIGIO', 'SIGXCPU', 'SIGXFSZ', 
        'SIGVTALRM', 'SIGPROF', 'SIGWINCH', 'SIGINFO', 
        'SIGUSR1', 'SIGUSR2'
    ],
    ROUTES = [];

function callin( delegator )
{
    var id = ROUTES.length;
    
    ROUTES[id] = {};
    this.__defineGetter__( 'id', function(){
        return id;
    });
    this.__defineGetter__( 'delegator', function(){
        return delegator;
    });
    // add signal events
    SIGNAMES.forEach( function( signame )
    {
        if( typeof delegator[signame] === 'function' ){
            process.on( signame, function(){
                delegator[signame].apply( delegator, arguments );
            });
        }
    });
}

callin.prototype.get = function( uri )
{
    var routes = ROUTES[this.id],
        // root directive
        methods = ( routes['/'] ) ? [].concat( routes['/'] ) : undefined,
        path = '',
        obj,len;
    
    // search directive
    uri = uri.replace( /\/{2,}/g, '/' ).replace( /\/+$/, '' ).split('/');
    if( uri[0] === '' ){
        uri.shift();
    }
    len = uri.length;
    while( ( len-- ) )
    {
        path += '/' + uri.shift();
        obj = routes[path];
        if( obj ){
            methods = methods.concat( obj );
        }
    }
    
    return ( methods.length ) ? methods : undefined;
};

callin.prototype.add = function( uri, directive )
{
    if( typeof uri === 'string' && directive instanceof Object )
    {
        var routes = ROUTES[this.id],
            p;
        
        if( !routes[uri] ){
            routes[uri] = [];
        }
        for( p in directive ){
            routes[uri].push( { name:p, args:directive[p], uri:uri } );
        }
    }
};

callin.prototype.remove = function( uri )
{
    var routes = ROUTES[this.id];
    if( routes[uri] ){
        delete routes[uri];
    }
};

callin.prototype.set = function( obj )
{
    var path,p;
    
    for( p in obj ){
        path = p.replace( /\/{2,}/g, '/' ).replace( /\/+$/, '' );
        this.add( ( path.length ) ? path : '/', obj[p] );
    }
};

callin.prototype.calling = function( uri, tick, ctx, callback )
{
    var routes = ROUTES[this.id],
        delegator = this.delegator,
        methods = undefined,
        path = '',
        len = 0,
        // find method
        nextPathMethods = function()
        {
            if( len-- )
            {
                path += '/' + uri.shift();
                if( routes[path] ){
                    methods = [].concat( routes[path] );
                    walkArray();
                }
                else
                {
                    if( tick ){
                        process.nextTick( nextPathMethods );
                    }
                    else {
                        nextPathMethods();
                    }
                }
            }
            // no more methods
            else
            {
                if( typeof callback === 'string' ){
                    delegator[callback]( ctx );
                }
                else {
                    callback();
                }
            }
        },
        // callback from delegator
        invokeNext = function( ontick, done )
        {
            if( done )
            {
                if( typeof callback === 'string' ){
                    delegator[callback]( ctx );
                }
                else {
                    callback();
                }
            }
            else {
                tick = ontick;
                walkArray();
            }
        },
        // walk method array
        walkArray = function()
        {
            var m = methods.shift();
            
            if( !m ){
                nextPathMethods();
            }
            else
            {
                // call delegate method
                if( typeof delegator[m.name] === 'function' )
                {
                    if( tick ){
                        process.nextTick( function(){
                            delegator[m.name]( ctx, m, invokeNext, tick );
                        });
                    }
                    else {
                        delegator[m.name]( ctx, m, invokeNext, tick );
                    }
                }
                // next sibling
                else {
                    walkArray();
                }
            }
        };
    
    // replace double and last slash then split
    uri = uri.replace( /\/{2,}/g, '/' ).replace( /\/+$/, '' ).split('/');
    if( uri[0] === '' ){
        uri.shift();
    }
    len = uri.length;
    // root directive
    if( routes['/'] ){
        methods = [].concat( routes['/'] );
        walkArray();
    }
    else{
        nextPathMethods();
    }
};

module.exports = callin;
