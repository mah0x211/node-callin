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
    RE_SLASHES = new RegExp( '/{2,}', 'g' ),
    RE_TAIL_SLASH = new RegExp( '/+$' ),
    fnNo2Slash = function( path, rmTail )
    {
        if( typeof path === 'string' )
        {
            if( rmTail ){
                path = path.replace( RE_SLASHES, '/' )
                           .replace( RE_TAIL_SLASH, '' );
            }
            else {
                path = path.replace( RE_SLASHES, '/' );
            }
            
            return path;
        }
        
        return undefined;
    };

function callin( delegator, isStatic, route )
{
    this.routes = {};
    this.isStatic = ( isStatic ) ? true : false;
    
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
    
    // getter/setter
    this.__defineGetter__( 'delegator', function(){
        return delegator;
    });
    
    // set route if defined
    if( route ){
        this.setRoute( route );
    }
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

callin.prototype.addRoute = function( uri, directive )
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
        // pre-check delegator implements if static flag is true
        if( this.isStatic && 
            typeof this.delegator[directive.name] !== 'function' ){
            console.warn(
                'delegator does not implement method "' + 
                directive.name +  '"'
            );
        }
        else
        {
            var routes = this.routes;
            
            if( !( uri = fnNo2Slash( uri ) ) ){
                uri = '/';
            }
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

callin.prototype.removeRoute = function( uri )
{
    if( typeof uri === 'string' && this.routes[uri] ){
        delete this.routes[uri];
        return true;
    }
    
    return false;
};

callin.prototype.setRoute = function( route )
{
    var path,methods;
    
    for( var path in route )
    {
        methods = route[path];
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
                this.addRoute( path, methods[i] );
            }
        }
    }
};


callin.prototype.calling = function( uri, tick, ctx, callback )
{
    // replace double and last slash then split
    uri = fnNo2Slash( uri, true );
    if( uri )
    {
        var tracer = {
                __proto__: null,
                delegator: this.delegator,
                routes: this.routes,
                uri: uri.split('/'),
                tail: 0,
                pos: 0,
                methods: undefined,
                midx: 0,
                path: '',
                tick: tick,
                ctx: ctx,
                callback: callback
            };
        
        if( tracer.uri[0] === '' ){
            tracer.uri.shift();
        }
        tracer.tail = tracer.uri.length;
        tracer.methods = tracer.routes['/'];

        // root directive
        if( tracer.methods ){
            callin.invokeMethod( tracer );
        }
        else{
            callin.findNextPathMethods( tracer );
        }
        
        return true;
    }
    
    return false;
};

// find method
callin.findNextPathMethods = function( tracer )
{
    if( tracer.pos < tracer.tail )
    {
        tracer.path += '/' + tracer.uri[tracer.pos++];
        tracer.methods = tracer.routes[tracer.path];
        if( tracer.methods ){
            tracer.midx = 0;
            callin.invokeMethod( tracer );
        }
        else {
            callin.findNextPathMethods( tracer );
        }
    }
    // no more path
    else
    {
        if( typeof tracer.callback === 'string' ){
            tracer.delegator[tracer.callback]( tracer.ctx );
        }
        else {
            tracer.callback( tracer.ctx );
        }
    }
};

// walk method array
callin.invokeMethod = function( tracer )
{
    var method = tracer.methods[tracer.midx++],
        invokeNext = function( ontick, done )
        {
            if( done )
            {
                if( typeof tracer.callback === 'string' ){
                    tracer.delegator[tracer.callback]( tracer.ctx );
                }
                else {
                    tracer.callback( tracer.ctx );
                }
            }
            else {
                tracer.tick = ( ontick === true );
                callin.invokeMethod( tracer );
            }
        };
    
    if( !method ){
        callin.findNextPathMethods( tracer );
    }
    // call delegate method
    else if( typeof tracer.delegator[method.name] === 'function' )
    {
        if( tracer.tick )
        {
            process.nextTick( function(){
                tracer.delegator[method.name]( 
                    tracer.ctx, 
                    method, 
                    invokeNext, 
                    tracer.tick
                );
            });
        }
        else
        {
            tracer.delegator[method.name]( 
                tracer.ctx, 
                method, 
                invokeNext, 
                tracer.tick
            );
        }
    }
    // next sibling
    else {
        callin.invokeMethod( tracer );
    }
};


module.exports = callin;

