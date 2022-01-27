/* jshint node:true */
/*
 * Tesla API routes
 */
'use strict';

var _ = require('underscore'),
  express = require('express'),
  async = require('async'),
  moment = require('moment'),
  listingRoutes = require('./threadlisting'),
  userListRoutes = require('./userlists'),
  messageRoutes = require('./messages'),
  pointRoutes = require('./points'),
  fs = require('fs'),
  api = require('../src/api'),
  renderGenerator = require('../src/renderGenerator'),
  userprefs = {
    numthreads: 50,
    numcomments: 100,
  },
  stresstest = false,
  stressTester = stresstest
    ? require('../src/stressTester')
    : { routing: function () {} },
  uiErrorHandler = require('../src/uiErrorHandler'),
  newPostNotifier = require('../src/newPostNotifier'),
  XSSWrapper = require('../src/xsswrapper'),
  bcrypt = require('bcrypt');

function setUser(req, user) {
  req.session.user = user;
}

function rememberUser(res, username, token) {
  var cookieOptions = {
    maxAge: 1000 * 60 * 60 * 24 * 365,
  };
  res.cookie('rememberUser', username, cookieOptions);
  res.cookie('rememberToken', token, cookieOptions);
}

function forgetUser(res) {
  var cookieOptions = {
    maxAge: 0,
  };
  res.cookie('rememberUser', '', cookieOptions);
  res.cookie('rememberToken', '', cookieOptions);
}

function checkAuth(req, res, next) {
  if (!req.session || !req.session.user || req.session.user.banned) {
    res.status(401);
    if (req.route.method === 'get') {
      return res.redirect('/');
    }
    return res.end();
  }
  next();
}

function checkUnauth(req, res, next) {
  if (req.session && req.session.user) {
    return res.redirect('/');
  }
  next();
}

function ping(req, res, next) {
  if (!req.session.user) return next();
  api.ping(
    res,
    {
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    },
    req.session.user,
    function (err, user) {
      if (err) return next(err);
      req.session.user = user;
      next();
    }
  );
}

module.exports = function routing() {
  var app = new express.Router();
  if (stresstest) {
    stressTester.routing(app);
  }

  app.get('*', function (req, res, next) {
    if (
      !req.session.user &&
      req.cookies.rememberUser &&
      req.cookies.rememberToken
    ) {
      api.getUser(
        res,
        {
          username: req.cookies.rememberUser,
        },
        {},
        function (err, user) {
          if (err || !user) return next();

          if (!bcrypt.compareSync(user.password, req.cookies.rememberToken)) {
            return next();
          }

          setUser(req, user);
          rememberUser(
            res,
            req.cookies.rememberUser,
            req.cookies.rememberToken
          );

          next();
        }
      );
    } else {
      next();
    }
  });

  listingRoutes(app, api, renderGenerator);
  messageRoutes(app, api, renderGenerator);
  userListRoutes(app, api);
  pointRoutes(app, api);

  function buddyListing(req, res, next) {
    var activeUsername = req.session.user.username;
    var username = req.route.params.username || '';
    var page = parseInt(req.route.params.page, 10) || 1;

    async.parallel(
      [
        function (done) {
          api.getUsers(
            res,
            {
              buddies: activeUsername,
              page: page,
            },
            req.session.user,
            function (err, json) {
              done(err, { buddies: json.users });
            }
          );
        },
        function (done) {
          api.getUsers(
            res,
            {
              buddies: activeUsername,
              countonly: true,
            },
            req.session.user,
            function (err, json) {
              done(err, { totalbuddies: json.totaldocs });
            }
          );
        },
        function (done) {
          api.getUsers(
            res,
            {
              ignores: activeUsername,
              size: 1000,
            },
            req.session.user,
            function (err, json) {
              done(err, { ignores: json.users });
            }
          );
        },
      ],
      function (err, results) {
        renderGenerator.buddyListingHandler(
          req,
          res,
          next
        )(
          null,
          _(results)
            .chain()
            .reduce(function (memo, item) {
              return _(memo).extend(item);
            }, {})
            .extend({
              prefill: username.replace('/', ''),
              page: page,
            })
            .value()
        );
      }
    );
  }

  function userListing(req, res, next) {
    var page = parseInt(req.route.params.page, 10) || 1;

    if (req.query.startswith) {
      return res.redirect('/users/' + req.query.startswith);
    }
    if (req.query.startswith === '') {
      return res.redirect('/users');
    }

    api.getUsers(
      res,
      {
        startswith: (req.route.params.search || '').replace('/', ''),
        page: page,
      },
      req.session.user,
      function (err, json) {
        json.page = page;
        renderGenerator.userListingHandler(req, res, next)(err, json);
      }
    );
  }

  // buddy / ignore listing
  app.get(
    '/buddies/:username/page/:page$',
    checkAuth,
    ping,
    function (req, res, next) {
      buddyListing(req, res, next);
    }
  );
  app.get('/buddies/:username?', checkAuth, ping, function (req, res, next) {
    buddyListing(req, res, next);
  });
  app.get('/buddies/page/:page$', checkAuth, ping, function (req, res, next) {
    buddyListing(req, res, next);
  });

  // all users
  app.get('/users/:search/page/:page$', ping, function (req, res, next) {
    userListing(req, res, next);
  });
  app.get('/users(/:search)?', ping, function (req, res, next) {
    userListing(req, res, next);
  });
  app.get('/users/page/:page$', ping, function (req, res, next) {
    userListing(req, res, next);
  });

  // view thread
  app.get('/thread/:threadUrlName', ping, function (req, res, next) {
    api.getThread(
      res,
      req.route.params || {},
      req.session.user,
      renderGenerator.threadDetailHandler(req, res, next)
    );
  });
  app.get('/thread/:threadUrlName/page/:page', ping, function (req, res, next) {
    if (req.route.params.page === '1') {
      return res.redirect('/thread/' + req.route.params.threadUrlName, 301);
    }
    api.getThread(
      res,
      req.route.params || {},
      req.session.user,
      renderGenerator.threadDetailHandler(req, res, next)
    );
  });
  // thread events
  app.get('/thread/:threadUrlName/events', function (req, res, next) {
    newPostNotifier.listen(
      req,
      res,
      'newpost:' + req.route.params.threadUrlName
    );
  });

  // post thread form
  app.get('/newthread', checkAuth, ping, function (req, res, next) {
    renderGenerator.newThreadHandler(req, res, next)(null, {}); // execute render method immediately, passing no error and empty data
  });

  // register form
  app.get('/register', checkUnauth, ping, function (req, res, next) {
    api.getInterviewQuestions(
      res,
      {},
      req.session.user,
      renderGenerator.registerHandler(req, res, next)
    );
  });

  // user page
  app.get('/user/:username', checkAuth, ping, function (req, res, next) {
    var renderer = renderGenerator.userDetailHandler(req, res, next);
    async.parallel(
      {
        comments: function (done) {
          api.getUserComments(
            res,
            req.route.params || {},
            req.session.user,
            done
          );
        },
        user: function (done) {
          api.getUser(res, req.route.params || {}, req.session.user, done);
        },
        buddyof: function (done) {
          api.getBuddyOf(res, req.route.params || {}, req.session.user, done);
        },
      },
      function (errs, data) {
        if (errs) return next(errs);

        renderer(
          null,
          _.extend(
            data.user,
            { comments: data.comments },
            { numbuddyof: data.buddyof.totaldocs }
          )
        );
      }
    );
  });

  // comment
  app.get('/comment/:commentId', ping, function (req, res, next) {
    api.getComment(
      res,
      req.route.params || {},
      req.session.user,
      function (err, comment) {
        if (err) return next(err);

        res.send(comment);
      }
    );
  });

  // ping
  app.get('/ping', function (req, res, next) {
    if (!req.session.user) {
      res.end();
    }
    api.ping(
      res,
      {
        ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      },
      req.session.user,
      function (err, user) {
        if (err) return next(err);
        res.end();
      }
    );
  });

  // preferences
  app.get('/preferences', checkAuth, ping, function (req, res, next) {
    api.getPreferences(
      res,
      {},
      req.session.user,
      renderGenerator.preferencesHandler(req, res, next)
    );
  });

  // forgot password
  app.get('/forgot-password', function (req, res, next) {
    renderGenerator.forgotPasswordHandler(req, res, next)(null, {});
  });
  app.get('/password-reset', function (req, res, next) {
    renderGenerator.passwordResetHandler(req, res, next)(null, {});
  });

  // chat
  app.get('/chat', function (req, res, next) {
    renderGenerator.chatHandler(req, res, next)(null, {});
  });

  // pending registrations
  app.get('/pendingregistrations', checkAuth, ping, function (req, res, next) {
    renderGenerator.pendingRegistrationsHandler(req, res, next)(null, {});
  });

  // POSTs
  // upload image via clipboard post
  app.post('/pasteimagedata', function (req, res, next) {
    var dataURL = req.body.dataURL;

    api.createImage(res, req.body, req.session.user, function (err, json) {
      if (err) {
        res.status(413);
        return res.send(err);
      }

      res.send(json);
    });
  });
  // preferences
  app.post('/preferences', checkAuth, function (req, res, next) {
    var body = req.body,
      files = req.files,
      avatarFile = files && files.emot_upload,
      callsToMake = [];

    callsToMake.push(
      function (done) {
        api.updatePersonalDetails(res, body, req.session.user, done);
      },
      function (done) {
        api.updateWebsites(res, body, req.session.user, done);
      },
      function (done) {
        api.updateForumPreferences(res, body, req.session.user, done);
      }
    );

    if (avatarFile && avatarFile.size) {
      callsToMake.push(function (done) {
        api.updateAvatar(avatarFile, req.session.user, done);
      });
    }

    if (body.old_password && body.password && body.password2) {
      callsToMake.push(function (done) {
        api.changePassword(res, body, req.session.user, done);
      });
    }

    if (body.email && body.email !== req.session.user.email) {
      callsToMake.push(function (done) {
        api.updateEmail(res, body, req.session.user, done);
      });
    }

    async.parallel(callsToMake, function (err, responses) {
      if (err) {
        return api.getPreferences(
          res,
          {},
          req.session.user,
          function (preferencesErr, preferences) {
            _.extend(req.body, preferences);
            uiErrorHandler.handleError(err, req, res, next, 'preferences');
          }
        );
      }

      res.redirect('/preferences');
    });
  });

  // post thread
  app.post('/newthread', checkAuth, ping, function (req, res, next) {
    api.postThread(res, req.body, req.session.user, function (err, thread) {
      if (err) {
        return uiErrorHandler.handleError(err, req, res, next, 'newthread');
      }
      if (req.body.redirect) {
        res.redirect('/thread/' + thread.urlname);
      } else {
        res.send(thread);
      }
    });
  });

  // post comment
  app.post(
    '/thread/:threadUrlName',
    checkAuth,
    ping,
    function (req, res, next) {
      var threadid = req.body.threadid;

      api.postComment(res, req.body, req.session.user, function (err, json) {
        if (err) {
          return api.getThread(
            res,
            req.route.params || {},
            req.session.user,
            function (currentThreadErr, currentThreadData) {
              _.extend(req.body, currentThreadData);
              return uiErrorHandler.handleError(
                err,
                req,
                res,
                next,
                'postcomment'
              );
            }
          );
        }

        newPostNotifier.emit('newpost:' + req.route.params.threadUrlName);

        if (req.body.redirect) {
          var pageNum = Math.ceil(
            json.comment.positionInThread / req.session.user.comment_size
          );
          var url = ['thread', req.route.params.threadUrlName];

          if (pageNum > 1) {
            url = url.concat(['page', pageNum]);
          }

          res.redirect(url.join('/') + '#bottom');
        } else {
          res.send(comment);
        }
      });
    }
  );

  // register
  app.post('/register', ping, function (req, res, next) {
    var body = req.body;
    body.ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    api.registerUser(res, body, req.session.user, function (err, pendingUser) {
      if (err) {
        return uiErrorHandler.handleError(err, req, res, next, 'register');
      }
      api.resetAvatar(pendingUser, function (err) {
        if (err) {
          return uiErrorHandler.handleError(err, req, res, next, 'register');
        }
        renderGenerator.registrationSuccessHandler(
          req,
          res,
          next
        )(null, pendingUser);
      });
    });
  });

  // login
  app.post('/login', ping, function (req, res, next) {
    api.handleLogin(res, req.body, req.session.user, function (err, user) {
      if (err) {
        return uiErrorHandler.handleError(err, req, res, next, 'login');
      }
      if (user && user.username) {
        setUser(req, user);
        if (user.rememberMeToken) {
          rememberUser(res, user.username, user.rememberMeToken);
        }
      } else {
        delete req.session.user;
      }
      res.redirect(req.headers['referer']);
    });
  });

  // edit title
  app.post('/title/edit', ping, function (req, res, next) {
    api.changeTitle(res, req.body, req.session.user, function (err) {
      if (err) {
        res.status(400);
        return res.send(err);
      }

      res.redirect(req.headers['referer']);
    });
  });

  // logout
  app.post('/logout', ping, function (req, res, next) {
    delete req.session.user;
    forgetUser(res);
    res.redirect('/');
  });

  // forgot password
  app.post('/forgot-password', function (req, res, next) {
    api.forgottenPasswordEmail(res, req.body, {}, function (err, success) {
      if (err) return next(err);

      res.send(success);
    });
  });
  app.post('/password-reset', function (req, res, next) {
    api.resetPassword(res, req.body, function (err, json) {
      if (err) {
        return uiErrorHandler.handleError(
          err,
          req,
          res,
          next,
          'password-reset'
        );
      }

      var user = json.user;

      if (user && user.username) {
        setUser(req, user);
        res.redirect('/');
      } else {
        console.log(user);
        res.end();
      }
    });
  });

  // PUT
  // edit comment
  app.put('/comment/:commentid', ping, function (req, res, next) {
    api.editComment(res, req.body, req.session.user, function (err, comment) {
      if (err) return next(err);

      if (req.body.redirect) {
        res.redirect(req.headers['referer'] + '#bottom');
      } else {
        res.send(comment);
      }
    });
  });

  app.put('/togglehtml', function (req, res, next) {
    api.toggleHTML(res, {}, req.session.user, function (err, user) {
      if (err) return next(err);

      res.send(user);
    });
  });

  app.put('/thread/:threadUrlName/close', function (req, res, next) {
    api.closeThread(
      req,
      {
        threadUrlName: req.route.params.threadUrlName,
      },
      req.session.user,
      function (err, json) {
        if (err) return next(err);

        res.send(json);
      }
    );
  });

  app.put('/thread/:threadUrlName/open', function (req, res, next) {
    api.openThread(
      req,
      {
        threadUrlName: req.route.params.threadUrlName,
      },
      req.session.user,
      function (err, json) {
        if (err) return next(err);

        res.send(json);
      }
    );
  });

  app.put('/thread/:threadUrlName/nsfw', function (req, res, next) {
    api.markThreadNSFW(
      req,
      {
        threadUrlName: req.route.params.threadUrlName,
      },
      req.session.user,
      function (err, json) {
        if (err) return next(err);

        res.send(json);
      }
    );
  });

  app.put('/thread/:threadUrlName/sfw', function (req, res, next) {
    api.markThreadSFW(
      req,
      {
        threadUrlName: req.route.params.threadUrlName,
      },
      req.session.user,
      function (err, json) {
        if (err) return next(err);

        res.send(json);
      }
    );
  });

  /**
   *  Send the body directly back to the client after lean
   *  /ajax/preview
   */
  app.post('/ajax/preview', function (req, res, next) {
    var data;
    data = XSSWrapper(req.body.content)
      .convertNewlines()
      .convertPinkies()
      .convertMe(req.session.user)
      .convertYou()
      .clean()
      .value();

    res.send({ content: data });
  });

  return app.middleware;
};
