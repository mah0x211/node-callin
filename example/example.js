var pkg = {
        callin: require('../callin')
    };

function sample()
{
    var callin = new pkg.callin( this );
    
    callin.setRoute( require(__dirname + '/route.js') );
    // console.log( JSON.stringify( callin.routes, false, '    ' ) );
    callin.calling( '/home/pref/index.htm/', false, 'sample context', function()
    {
        console.log( 'done' );
    });
}

sample.prototype.gateway = 
sample.prototype.top = 
sample.prototype.authen =
sample.prototype.home =
sample.prototype.preference = function( ctx, methods, next, tick ){
    console.log( arguments );
    next();
};
new sample();
