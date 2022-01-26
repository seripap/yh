/*
  Nested Quotes object
*/
function NestedQuote($node){
  this.$node = $node;
  this.labels = {
    'up'  : 'Show older',
    'down': 'Hide'
  };
  this.doNesting();
}
NestedQuote.prototype.doNesting = function(){
  var $nestedQuote = this.$node.find('.tquote:first');
  
  if($nestedQuote.length){
    this.applyNesting($nestedQuote);
  }
};
NestedQuote.prototype.makeToggle = function($quoteToToggle){
  var $toggle = $('<a href="#" class="quote-nested-toggle"></a>').text(this.labels.up),
      labels = this.labels;

  $toggle.click(function(e){
    e.preventDefault();
    
    if($quoteToToggle.is(':hidden')){
      $toggle.text(labels.down);
      $quoteToToggle.show();
    }else{
      $toggle.text(labels.up);
      $quoteToToggle.hide();
    }
  });
  return $toggle;
};
NestedQuote.prototype.skipToggle = function($quoteToSkip){
  var $fragment = $quoteToSkip.clone(),
      $nextFragment = this.$node.clone();

  $fragment.add($nextFragment).find('.tqname').remove();
  $fragment.add($nextFragment).find('img').each(function(){
    var $img = $(this);
    $img.before('<span>'+$img.attr('href')+'</span>');
  });
  return $fragment.text() === $nextFragment.text();
};
NestedQuote.prototype.applyNesting = function($childQuote){
  if(!$childQuote){
    return;
  }
  if(this.skipToggle($childQuote)){
    return this.applyNesting($childQuote.find('.tquote:first'));
  }

  $childQuote.before(this.makeToggle($childQuote));
  $childQuote.hide();
};

if($('.welcome a:first').length){
  $('.you').html($('<div>').append($('.welcome a:first').clone()).html());
}

$(function () {
  var title, tpl = $("#title-input").html();

  $("#main-title.changeling").bind("click", function(){
    if ($(this).is(":not(.editing)")) {
      title = $.trim($('h3', this).text());
      $(this).addClass("editing");
      $('h3', this).empty().append(tpl);
      var input = $(this).find("#title-input");
      input.val(title);
      input[0].focus();
      input[0].select();
    }
  });

  $("body").on("click", "#cancel-title", function(){
    $('h3', "#main-title").empty().text(title);
    $("#main-title").removeClass("editing");
  });

  $("body").on("click", "#save-title", function(){
    var newTitle = $("#title-input").val();
    var data = "title=" + encodeURIComponent(newTitle);
    data += isThread() ? "&thread_id=" + thread.id() : '';
    $.ajax({
      type: "POST",
      url: "/title/edit",
      data: data,
      success: function(msg){
        $('h3', "#main-title").empty().text(newTitle);
	$("#main-title").removeClass("editing");
      }
    });
  });

  $('#toggle-html').bind('click', function(){
    $.ajax({
      method: 'put',
      url: '/togglehtml',
      success: function(data) {
        window.location.reload(true);
      }
    });
  });
  
  $('.hide-thread').bind('click', function(e){
    e.preventDefault();
    e.stopPropagation();
  
    var button = $(this),
        toHide = button.hasClass('added'),
        threadurl = button.attr('href'),
        threadid = button.data('id'),
        splitUrl = threadurl.split('/'),
        hideType = splitUrl[splitUrl.length-1];

  
    $.ajax({
      method: 'put',
      url: threadurl,
      data: {
        threadid: threadid
      },
      success: function(data) {
        button.toggleClass('added', !toHide);
        button.parent('.five').parent('.thread').slideUp().next().slideUp();
        hideType = button.hasClass('added') ? 'unhide' : 'hide';
        splitUrl[splitUrl.length-1] = hideType;
        button.attr('href', splitUrl.join('/'));

      }
    });
  });
  
  $('.favourite').bind('click', function(e){
    e.preventDefault();
    e.stopPropagation();
  
    var button = $(this),
        threadurl = button.attr('href'),
        threadid = button.data('id'),
        splitUrl = threadurl.split('/'),
        favouriteType = splitUrl[splitUrl.length-1];
  
    $.ajax({
      method: 'put',
      url: threadurl,
      data: {
        threadid: threadid
      },
      success: function(data){
        button.toggleClass('added');
        favouriteType = button.hasClass('added') ? 'unfavourite' : 'favourite';
        splitUrl[splitUrl.length-1] = favouriteType;
        button.attr('href', splitUrl.join('/'));
      }
    });
  });
  
  
  function isThread() {
    return (typeof(window.thread) == "undefined")?  false: true;
  }

  var defaultLoginBox = $('#login-box').html();
  $('#login-form').on('submit', function(e) {
    e.preventDefault();

    var data = {
      username: $('#username').val(),
      password: $('#password').val()
    };

    $.ajax({
      url: '/login', type: 'POST', data: data
    }).fail(function(err) {
      if(err.status === 401){
        $('.error').text('Login incorrect');
      }else if(err.status === 403){
        $('.error').text('Account banned');
      }else{
        $('.error').text('Unknown error');
      }
    }).then(function() {
      window.location.reload();
    });
  });


  $('#forgot-password').on('click', function(e){
    e.preventDefault();

    var $loginBox = $('#login-box');

    $.ajax({
      url: '/forgot-password',
      success: function(content){
        $loginBox.html(content);
        $loginBox.find('form').submit(function(e){
          e.preventDefault();
          var emailAddress = $('#forgot-email').val();

          if(emailAddress && emailAddress.length > 1){
            $.ajax({
              type: 'post',
              url: '/forgot-password',
              data: {
                email: emailAddress
              },
              success: function(){
                $loginBox.html('<h5>Check your email!</h5><p>An email containing a link to reset your password has been sent to ' + emailAddress + '</p>');
              },
              error: function(){
                $loginBox.html('<h5>Could not send email :(</h5><p>Could not send email to ' + emailAddress + '</p>');
              }
            });
          }
        });
      }
    });
  });

  $('#forgot-request').on('submit', function(e){
    e.preventDefault();

    var data = {
      email: $('#forgot-email').val(),
      key: $('#forgot-key').val()
    };

    $.ajax({
      url: '/auth/forgot_password', type: 'POST', data: data
    }).fail(function(data) {
      $('.error').text(JSON.parse(data.responseText).error);
    }).then(function(data) {
      $('#login-box').html(defaultLoginBox);
      $('.error').text('Password reset email sent');
    });

  });

  $('#forgot-back').on('click', function(e){
    e.preventDefault();
    $('#login-box').html(defaultLoginBox);
  });

  $('#hide-ads').on('click', function(e){
    e.preventDefault();

    $.ajax({
      url: '/ajax/hide_ads/'+session_id,
      success: function(data){
        if (data == 1) {
          window.location.reload(false);
        }
      }
    });
  });

  $('#unhide-ads').on('click', function(e){
    e.preventDefault();

    $.ajax({
      url: '/ajax/show_ads/'+session_id,
      success: function(data){
        if (data == 1) {
          window.location.reload(false);
        }
      }
    });
  });

  // buddy/ignore switching links
  $('.remove-acq, .toggle-acq').click(function(e){
    e.preventDefault();

    var $this = $(this),
        $parent = $(this).parent(),
        username = $(this).attr('rel'),
        reltypes = ['ignore','buddy'],
        relindex = $parent.filter('.buddy-listing').length,
        switchBuddyStatus = $this.hasClass('toggle-acq'),
        command = reltypes[relindex];

    // always remove
    $.ajax({
      method: 'post',
      url: '/buddies',
      data: {
        command: command,
        username: username,
        remove: true
      },
      success: function(data){
        var $userblock = $parent.detach();

        // add new association
        if(!switchBuddyStatus){ return; }

        command = reltypes[1-relindex];
        $.ajax({
          method: 'post',
          url: '/buddies',
          data: {
            command: command,
            username: username
          },
          success: function(data){
            if(command === 'ignore'){
              $userblock.removeClass('buddy-listing').addClass('enemy-listing');
              $userblock.find('.toggle-acq').text('buddilize');
              return $('#enemy-listings').append($userblock);
            }

            $userblock.removeClass('enemy-listing').addClass('buddy-listing');
            $userblock.find('.toggle-acq').text('ignore');
            $('#buddy-listings').append($userblock);
          }
        });
      }
    });

  });

  // points
  var $pointsButtons = $('.give-point, .take-point');
  $pointsButtons.click(function(e){
    var $this = $(this);
    var $pointscontainer = $this.parent().find('.current-points');
    var routeEnd = $this.data('type') === 'minus' ? 'removepoint' : 'addpoint';
    var commentId = $this.data('commentid');
    var pendingUserId = $this.data('pendinguserid');
    var url = '/comment/' + commentId + '/' + routeEnd;
    if(pendingUserId){
        url = '/pendingusers/' + pendingUserId + '/' + routeEnd;
    }

    e.preventDefault();

    $.ajax({
      method: 'put',
      url: url,
      success: function(json){
        var pointsNow = json.points;
        if(json.pendingUsers){
          pointsNow = json.pendingUsers.points;
        }
        $pointsButtons.css({visibility: 'hidden'});
        $pointscontainer.text(pointsNow + ' point' + (pointsNow !== 1 ? 's': ''));
      },
      error: function(response){
        if(response.status === 401){
          $pointsButtons.css({visibility: 'hidden'});
          return $pointscontainer.text('Unauth');
        }
        $pointscontainer.text('Error');
      }
    });
  });

  // keyboard nav
  function createKeyboardNavListener(){
    var ignore = ['input','textarea','button'],
        routing = [
          {
            seq: [113,116], //qt
            path: '/'
          },
          {
            seq: [113,112], //qp
            path: '/f/participated'
          },
          {
            seq: [113,102], //qf
            path: '/f/favorites'
          },
          {
            seq: [113,104], //qh
            path: '/f/hidden'
          },
          {
            seq: [113,109], //qm
            path: '/messages/inbox'
          },
          {
            seq: [113,117], //qu
            path: '/users'
          }
        ],
        currentSequence = [],
        matchingRoute;

    return function(e){
      if(ignore.indexOf(e.target.nodeName.toLowerCase()) !== -1){
        return;
      }

      currentSequence.push(e.which);
      currentSequence = currentSequence.slice(-2);

      matchingRoute = _(routing).find(function(route){
        return _(route.seq).isEqual(currentSequence);
      });
      if(matchingRoute){
        self.location = matchingRoute.path;
      }
    };
  }
  $('body').keypress(createKeyboardNavListener());

  // collpase quotes
  var $quotes = $('.content > .tquote > .tquote');
  $quotes.each(function(i){
    new NestedQuote($(this));
  });

  $('.buddyform').each(function(){
    var $form = $(this);

  });

  // ping
  // function ping(){
  //   if($('.welcome').length){
  //     $.ajax('/ping');
  //   }
  //   setTimeout(ping, 30000);
  // }
  // setTimeout(ping, 30000);

  // search-box
  $('#search-box').submit(function(e){
    if(!$('#search-phrase').val().trim().length){
      e.preventDefault();
    }
  });

  // error page
  if($('.amazing-game').length){
    function navigateTo(loc, x,y){
      window.location.href = loc + '?x='+x+'&y='+y;
    }

    var x = parseInt($('.position-x').val(), 10),
        y = parseInt($('.position-y').val(), 10),
        loc = window.location.href.split('?')[0];

    $('.go-north').click(function(){
      navigateTo(loc, x, y-1);
    });
    $('.go-south').click(function(){
      navigateTo(loc, x, y+1);
    });
    $('.go-west').click(function(){
      navigateTo(loc, x-1, y);
    });
    $('.go-east').click(function(){
      navigateTo(loc, x+1, y);
    });
  }

}); // end ready
