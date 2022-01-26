
/**
 * Module dependencies.
 */

var express = require('express'),
    routes = require('./routes'),
    http = require('http'),
    path = require('path'),
    sessionGenerator = require('./src/sessionGenerator'),
    sessionStore = new express.session.MemoryStore({reapInterval: 60*60*1000}),
    app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 3100);
  app.use(express.favicon(__dirname + '/public/favicon.ico'));
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser('0rly?YA,rly!'));
  app.use(sessionGenerator(sessionStore));
  app.use(routes());
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
