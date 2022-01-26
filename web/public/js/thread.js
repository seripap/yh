function cloneObj(obj) {
  return jQuery.extend(true, {}, obj);
}

jQuery.fn.reverse = function() {
  return this.pushStack(this.get().reverse(), arguments);
};

$.fn.selectRange = function(start, end) {
  if (!end) {
    end = start;
  }

  return this.each(function() {
    if (this.setSelectionRange) {
      this.focus();
      this.setSelectionRange(start, end);
    } else if (this.createTextRange) {
      var range = this.createTextRange();
      range.collapse(true);
      range.moveEnd('character', end);
      range.moveStart('character', start);
      range.select();
    }
  });
};


/**
 *  Edit Post Fix: Preserve carriage returns when using .val()
 *  Stack Overflow post: http://bit.ly/1DTD34k
 */
jQuery.valHooks.textarea = {
  get: function(elem) {
    return elem.value.replace( /\r?\n/g, "\r\n" );
  } 
};


// ### Respsonsive Embed
function responsiveEmbed(content) {
  return ['<div class="embed-container">', content, '</div>'].join('');
}

function format_special(element)
{

  var ytube = new RegExp('(?:")?http(?:s)?://(?:www.)?youtu(?:be)?.(?:[a-z]){2,3}' +
                         '(?:[a-z/?=]+)([a-zA-Z0-9-_]{11})(?:[a-z0-9?&-_=]+)?');
  var vimeo = new RegExp('http(?:s)?://(?:www.)?vimeo.com/([0-9]+)(?:#[a-z0-9?&-_=]*)?');
  var gifv = new RegExp('http(?:s)?://.*?\.imgur\.com\/(.*?)\.gifv');

  $(element).each(function(){

    var text = $(this).find("*").andSelf().contents().each(function () {

      if (this.nodeType !== 3 || this.parentNode.nodeName === 'A') {
        return;
      }

      var tmp = this.textContent;

      if(window.videoEmbedder && videoEmbedder.embedYoutube){
        tmp = tmp.replace(ytube, videoEmbedder.embedYoutube);
        tmp = tmp.replace(gifv, videoEmbedder.embedVideo);
      }

      tmp = tmp.replace(vimeo, function(a, b){
        return (a.indexOf("\"") != -1) ? a :
          responsiveEmbed('<iframe src="http://player.vimeo.com/video/' + b +
          '?title=0&amp;byline=0&amp;portrait=0"' +
          'frameborder="0" webkitAllowFullScreen allowFullScreen></iframe><br />');
      });

      if (tmp !== this.textContent && $('#toggle-html').data('active')) {
        $(this).replaceWith(tmp);
      }

    });

    // Reverse so we handle nested quotes
    $(this).find('blockquote').reverse().each(function(){
      var user = $(this).attr('title') || 'Someone';
      $(this).prepend('<div class="tqname">' + user + ' said:</div>').addClass('tquote');
    });
  });

  if(window.Autolinker){
    $('.content').each(function(){
      if(!$(this).find('.youtube_wrapper').length){
        this.innerHTML = Autolinker.link(this.innerHTML);
      }
    });
  }

  $('spoiler').each(function() {
    var warning_msg = 'Warning! May contain spoilers. Click to reveal.',
        $spoiler = $('<div class="spoiler"></div>'),
        $disclaimer = $('<div class="spoiler-disclaimer"></div>').text(warning_msg),
        $content = $('<div class="spoiler-content"></div>').html( $(this).html() );
    $spoiler.append($disclaimer).append($content).click(function(){
      $disclaimer.toggle();
      $content.toggleClass('spoiled');
    });
    $(this).replaceWith($spoiler);
  });
}

$(document).ready(function(){
  format_special('.comment .content, .recent-post-content');
});


// paste image
$('#thread-content-input').pasteImageReader(function(data){
  var $this = $(this);

  $this.parent().find('.error').remove();
  $this.after('<p class="loading">Uploading image...</p>');

  $.ajax({
    method: 'post',
    url: '/pasteimagedata',
    data: {
      dataURL: data.dataURL
    },
    success: function(responseData){
      $this.parent().find('.error,.loading').fadeOut();
      $this.val($this.val() + ' <img src="' + responseData.filepath + '" width="' + data.width + '" height="' + data.height + '">');
    },
    error: function(response){
      if(response.status === 413){
        $this.parent().find('.error,.loading').remove();
        $this.after('<p class="error">Image too large</p>');
      }
    }
  });
});

if(document.getElementById('thread-content-input')){
document.getElementById('thread-content-input').addEventListener("drop", function(e){
  e.preventDefault();

  var file = e.dataTransfer.files[0],
      reader = new FileReader(),
      $this = $('#thread-content-input');

  reader.onload = function(fileEvent){
    var img = document.createElement('img');
    img.onload = function(){
      $.ajax({
        method: 'post',
        url: '/pasteimagedata',
        data: {
          dataURL: fileEvent.target.result
        },
        success: function(responseData){
          $this.parent().find('.error,.loading').fadeOut();
          $this.val($this.val() + ' <img src="' + responseData.filepath + '" width="' + img.naturalWidth + '" height="' + img.naturalHeight + '">');
        },
        error: function(response){
          if(response.status === 413){
            $this.parent().find('.error,.loading').remove();
            $this.after('<p class="error">Image too large, maximum file size for pasted images is 2MB</p>');
          }
        }
      });
    };
    img.src = fileEvent.target.result;
  };
  reader.readAsDataURL(file);
}, false);
}

$('#preview-button').on('click', function(e){
  e.preventDefault();
  var post = $("#thread-content-input").val();
  $.post('/ajax/preview', {content: post})
    .then(function(data) {
      $("#comment-preview .content").html(data.content);
      format_special("#comment-preview .content");
      //prettyPrint();
      $("#comment-preview").show();
    });
});

$("#comment-form").on("submit", function() {
  if ($("#thread-content-input").val().length === 0) {
    return false;
  }
  $("#submit-button").attr('disabled', 'disabled');

  if (hasStorage) {
    localStorage.removeItem(key);
  }
  this.submit();
});

selected = {
  html: null,
  comment_id: null
};

$('.content').click(function() {
  selected.html = null;
  selected.comment_id = null;

  if(window.getSelection) {
    // not IE case
    selObj = window.getSelection();
    if(selObj.focusNode) {
      selRange = selObj.getRangeAt(0);

      p = selRange.commonAncestorContainer;
      while(p.parentNode && !$(p).hasClass("comment-container")) {
	p = p.parentNode;
      }

      if(p.id) {
	dash = p.id.lastIndexOf('-');

	if(dash != -1) {
    selected.comment_id = p.id.substring(dash+1);

    fragment = selRange.cloneContents();
    e = document.createElement('b');
    e.appendChild(fragment);
    selected.html = e.innerHTML;
	}
      }
      //selObj.removeAllRanges();
    }
  } else if (document.selection &&
             document.selection.createRange &&
             document.selection.type != "None") {
    // IE case
    selected.html = document.selection.createRange().htmlText;
  }
});

$('.censor').click(function() {
  $(this).children('.content').toggle();
});

thread = {
  status_text: {'nsfw': ['Unmark Naughty', 'Mark Naughty'],
                'closed': ['Open Thread', 'Close Thread']},
  comments: [],

  get_comment_details: function(comment_id, callback)
  {
    // this is duplicating content on quotes
    var $container = $('#comment-'+comment_id+' .content'),
        author = $('#comment-'+comment_id+' .username a').text(),
        currentUser = $('.welcome a:first').text();

    $.ajax({
      method: 'get',
      url: '/comment/' + comment_id,
      success: function(data){
        if(!data || !data.content) return;

        thread.comments[comment_id] = {
          container: $container,
          rendered: $container.html(),
          data: {
            content: data.content.replace(/<br>/g, "\n").replace(/<br \/>/g, "\n"),
            owner: (data.postedby === currentUser) && $('#comment-'+comment_id+' #thread-control').length === 1 || moment(data.created).diff(new Date())>-3600000
          },
          author: author
        };
        callback();
      }
    });
  },

  quote: function(comment_id)
  {
    if (thread.comments[comment_id] !== undefined) {
      if(selected.comment_id && selected.comment_id != comment_id || !selected.html) {
        content = thread.comments[comment_id].data.content;
      } else {
        content = selected.html;
      }

      selected.html = null;
      selected.comment_id = null;

      html = "<blockquote title=\"" + $.trim(thread.comments[comment_id].author) +
        "\">" + content + "</blockquote>";

      $("#thread-content-input").val($("#thread-content-input").val() + html);

      $(window).scrollTop($("#thread-content-input").offset().top);
      $("#thread-content-input").focus();
      $("#thread-content-input").scrollTop($("#thread-content-input")[0].scrollHeight -
                                           $("#thread-content-input").height());
      $("#thread-content-input").selectRange($("#thread-content-input").val().length);
    } else {
      thread.get_comment_details(comment_id, function(){
	thread.quote(comment_id);
      });
    }
  },

  save: function(comment_id)
  {
    var post_data = {
      comment_id: comment_id,
      content: $('#comment-'+comment_id+' .content textarea').val(),
      isFirst: $('#comment-'+comment_id+' .user-block').length === 1
    };

    $.ajax({
      method: 'put',
      url: '/comment/' + comment_id,
      data: post_data,
      success: function(data){
        var html = data.content
        if(Math.floor(data.edit_percent)>0){
          html += '<div class="edited-percent">Edited ' + Math.floor(data.edit_percent) + '%</div>';
        }
        format_special($('#comment-'+comment_id+' .content').html(html));
        delete thread.comments[data._id];
        // prettyPrint();
      }
    });
  },

  set_status: function(thread_id, keyword, status, key)
  {
    $.get(
      '/ajax/set_thread_status/'+ thread_id +'/'+ keyword +'/'+ status +'/'+ key,
      function(data) {
        if(data !== 1) return;

        if(keyword == 'deleted') {
          window.location = '/';
          return;
        }
          status = status == 1 ? 0 : 1;

        $('#control-'+ keyword +' span').unbind('click').bind('click', function(){
        thread.set_status(thread_id, keyword, status, key);
        return false;
        }).html(thread.status_text[keyword][status]);
      }
    );
  },

  view_original: function(comment_id)
  {
    if (thread.comments[comment_id] !== undefined) {
      $('#comment-' + comment_id + ' .content')
        .html(thread.comments[comment_id].rendered);
    }
  },

  view_source: function(comment_id)
  {
    if (thread.comments[comment_id] !== undefined) {

      comment = thread.comments[comment_id];

      // View source is already active, switch back to original
      if (comment.container.find("textarea").length !== 0) {
        thread.view_original(comment_id);
        return;
      }

      comment.container.html($('<textarea>', {
	'id': 'comment-' + comment_id + '-source',
	'val': comment.data.content
      }));

      if (comment.data.owner) {
	comment.container.append(
          $('<button>',{'html': 'Save'})
            .bind('click', function() {thread.save(comment_id);} ));
      }

      comment.container.append(
        $('<button>', {'html': 'Close'})
          .bind('click', function(){thread.view_original(comment_id);} ));

    } else {
      thread.get_comment_details(comment_id, function(){
	thread.view_source(comment_id);
      });
    }
  },

  id: function()
  {
    return $('.favourite').attr('rel');
  }
};

function insertAtCaret(areaId,text) {
  var txtarea = document.getElementById(areaId);
  var scrollPos = txtarea.scrollTop;
  var strPos = 0;
  var selection;
  var removeOffset;
  var range;
  var br = ((txtarea.selectionStart || txtarea.selectionStart == '0') ? "ff" : (document.selection ? "ie" : false ) );

  if (br == "ie") {
    txtarea.focus();
    range = document.selection.createRange();
    selection = range.text;
    range.moveStart ('character', -txtarea.value.length);
    strPos = range.text.length;
  } else if (br == "ff") {
    strPos = txtarea.selectionStart;
    selection = (txtarea.value).substring(strPos, txtarea.selectionEnd);
  }

  var cursorOffset = text.indexOf('"');
  if(cursorOffset == -1 && !selection) {
	cursorOffset = text.indexOf('<', 1) - 1;
  }
  cursorOffset = cursorOffset == -1 ? 0 : text.length - cursorOffset - 1;

  var closeTag = text.indexOf("<", 1);
  if(closeTag == -1) {
    removeOffset = 0;
  } else {
    text = text.substring(0, closeTag) + selection + text.substring(closeTag);
    if(cursorOffset) {
      cursorOffset += selection.length;
    }
    removeOffset = selection.length;
  }

  var front = (txtarea.value).substring(0,strPos);
  var back = (txtarea.value).substring(strPos + removeOffset);
  txtarea.value=front+text+back;
  strPos = strPos + text.length - cursorOffset;

  if (br == "ie") {
    txtarea.focus();
    range = document.selection.createRange();
    range.moveStart ('character', -txtarea.value.length);
    range.moveStart ('character', strPos);
    range.moveEnd ('character', 0);
    range.select();
  }
  else if (br == "ff") {
    txtarea.selectionStart = strPos;
    txtarea.selectionEnd = strPos;
    txtarea.focus();
  }

  txtarea.scrollTop = scrollPos;
}

$('#control-closed').click(function(){
  var threadurlname = $('input[name=threadurlname]').val();

  $.ajax({
    method: 'put',
    url: '/thread/' + threadurlname + '/close',
    success: function(thread){
      window.location.reload();
    }
  });
});

$('#control-open').click(function(){
  var threadurlname = $('input[name=threadurlname]').val();

  $.ajax({
    method: 'put',
    url: '/thread/' + threadurlname + '/open',
    success: function(thread){
      window.location.reload();
    }
  });
});

$('body').on('click', '#control-nsfw', function(e){
  var threadurlname = $('input[name=threadurlname]').val();

  $.ajax({
    method: 'put',
    url: '/thread/' + threadurlname + '/nsfw',
    success: function(thread){
      $('#control-nsfw').attr('id', 'control-sfw').find('span').text('Unmark Naughty');
    }
  });
});

$('body').on('click', '#control-sfw', function(e){
  var threadurlname = $('input[name=threadurlname]').val();

  $.ajax({
    method: 'put',
    url: '/thread/' + threadurlname + '/sfw',
    success: function(thread){
      $('#control-sfw').attr('id', 'control-nsfw').find('span').text('Mark Naughty');
    }
  });
});

;(function($){
  var threadurlname = $('input[name=threadurlname]').val(),
      $notifications = $('#notifications'),
      postcount = 0,
      originalThreadTitle = $('title').text(),
      threadEvents;

  if(!threadurlname || !$notifications.length || !window.EventSource) return;

  threadEvents = new EventSource('/thread/' + threadurlname + '/events');

  $notifications.on('click', '#closenotify', function(e){
    e.preventDefault();
    $notifications.hide();
  }).on('click', '#notify', function(e){
    e.preventDefault();
    window.location.hash = '#bottom';
    window.location.reload(true);
  });

  threadEvents.addEventListener('message', function(e){
    postcount++;

    $('title').text([postcount, ' new posts | ', originalThreadTitle].join(''));


    $notifications
      .html('<a id="closenotify"></a><div id="notifier"><a id="notify" href="">'+postcount+' new post'+(postcount === 1 ? '':'s')+' added</a></div>')
      .show();
  }, false);

})(jQuery);


/**
 *  Save post content, local storage, moved from .net
 */
var $input = $('#thread-content-input');
var $form = $input.parents('form');
var key = document.title;

var hasStorage = (function() {
  try {
    return !!localStorage.getItem;
  } catch(e) {
    return false;
  }
}());

if ($input.length !== 0 && hasStorage) {

  if (localStorage.getItem(key)) {
    $input.val(localStorage.getItem(key));
  }

  $input.bind('keyup change', function() {
    localStorage.setItem(key, $input.val());
  });
}
