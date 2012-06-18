/*
    callin.js
    author: masatoshi teruya
    email: mah0x211@gmail.com
    copyright (C) 2011-2012, masatoshi teruya. all rights reserved.
    
    CREATE CALLER:
        var callin = new callin( delegator );
    
    ADDING ROUTING TABLE
        router.set( routing_table_format:Object );

    ROUTING TABLE FORMAT:
        {
            "/": [
                { name: "methodName1", args: "" }
            ],
            "/index.htm": [
                { name: "methodName2", args: "" }
            ],
            "/home/": [
                { name: "methodName3", args: "" }
            ],
            "/home/index.htm": [
                { name: "methodName4", args: "" }
            ],
        };
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
    ROUTES = [],
    fnNo2Slash = function( path, rmTail )
    {
        if( typeof path === 'string' )
        {
            if( rmTail ){
                path = path.replace( /\/{2,}/g, '/' ).replace( /\/+$/, '' );
            }
            else {
                path = path.replace( /\/{2,}/g, '/' );
            }
            return path;
        }
        return undefined;
    };

function callin( delegator, isStatic )
{
    var id = ROUTES.length,
        static = ( isStatic ) ? true : false;
    
    ROUTES[id] = {};
    this.__defineGetter__('id', function(){
        return id;
    });
    this.__defineGetter__('isStatic',function(){
        return static;
    });
    this.__defineGetter__( 'delegator', function(){
        return delegator;
    });
    this.__defineGetter__( 'routes',function(){
        return JSON.parse( JSON.stringify( ROUTES[id] ) );
    });
    // add signal events
    SIGNAMES.forEach( function( signame )
    {
        if( typeof delegator[signame] === 'function' )
        {
            process.on( signame, function()
            {
                var method = delegator[signame];
                if( typeof method === 'function' ){
                        method.apply( delegator, arguments );
                }
            });
        }
    });
}

callin.prototype.get = function( uri )
{
    var routes = ROUTES[this.id],
        // get root directive
        methods = ( routes['/'] ) ? [].concat( routes['/'] ) : undefined;
    
    // search directive
    uri = fnNo2Slash( uri, true );
    if( typeof uri === 'string' )
    {
        var path,obj;
        
        uri = uri.split('/');
        if( uri[0] === '' ){
            uri.shift();
        }
        for( var i = 0, len = uri.length; i < len; i++ )
        {
            path += '/' + uri[i];
            if( ( obj = routes[path] ) ){
                methods = methods.concat( obj );
            }
        }
    }
    
    return ( methods.length ) ? methods : undefined;
};

callin.prototype.add = function( uri, directive )
{
    if( typeof uri !== 'string' ){
        console.warn('uri must be type of String');
    }
    else if( !( directive instanceof Object ) ){
        console.warn('directive must be type of Object');
    }
    else if( !directive.name ){
        console.warn( 'directive.name undefined' );
    }
    else if( typeof directive.name !== 'string' ){
        console.warn('directive.name must be type of String');
    }
    else if( directive.args && !( directive.args instanceof Array ) ){
        console.warn('directive.args must be type of Array');
    }
    else
    {
        var routes = ROUTES[this.id];
        
        if( !( uri = fnNo2Slash( uri ) ) ){
            uri = '/';
        }
        
        // pre-check delegator implements if static flag is true
        if( this.isStatic && typeof this.delegator[directive.name] !== 'function' ){
            console.warn('delegator does not implement method "' + directive.name +  '"');
        }
        else
        {
            if( !routes[uri] ){
                routes[uri] = [];
            }
            routes[uri].push({ 
                name: directive.name, 
                args: directive.args||undefined, 
                uri:uri 
            });
            
            return true;
        }
    }
    
    return false;
};

callin.prototype.remove = function( uri )
{
    var routes = ROUTES[this.id];
    
    if( typeof uri === 'string' && routes[uri] ){
        delete routes[uri];
        return true;
    }
    
    return false;
};

callin.prototype.set = function( obj )
{
    var path,methods;
    
    for( var path in obj )
    {
        methods = obj[path];
        if( typeof path !== 'string' ){
            throw TypeError('invalid type of path: ' + ( typeof path ) );
        }
        else if( !( methods instanceof Array ) ){
            throw TypeError('invalid type of method list: ' + ( typeof methods ) );
        }
        else
        {
            if( !( path = fnNo2Slash( path, true ) ) ){
                path = '/';
            }
            for( var i = 0, len = methods.length; i < len; i++ ){
                this.add( path, methods[i] );
            }
        }
    }
};

callin.prototype.calling = function( uri, tick, ctx, callback )
{
    // replace double and last slash then split
    uri = fnNo2Slash( uri, true );
    if( typeof uri === 'string' )
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
                    tick = ( ontick === true );
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
        
        uri = uri.split('/');
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
        
        return true;
    }
    
    return false;
};

module.exports = callin;

