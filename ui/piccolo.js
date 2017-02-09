(function () {

	var Piccolo = {
		loadMap: function (file) {
			var reader = new FileReader();
			reader.onload = function (e) {
				try {
					window.MAP = JSON.parse(e.target.result);
					Piccolo.updateTagList();
					$('#header-filter, #header-showtags, #header-search').prop('disabled', false);
					$('main').empty();
					$('#main-start').hide();
					$('#main-loaded').show();
				} catch (e) {
					alert('Error while loading map file.');
				}
			};
			reader.readAsText(file);
		},
		updateTagList: function () {
			if (!window.MAP) {
				return;
			}
			var datalist = document.getElementById('header-tags');
			datalist.innerHTML = '';
			var dialogTags = document.getElementById('dialog-tags-content');
			dialogTags.innerHTML = '';
			Object.keys(MAP.tags).sort().forEach(function (tag) {
				var option = document.createElement('option');
				option.value = tag.replace(/\_/g, ' ');
				datalist.appendChild(option);
				var badge = document.createElement('div');
				badge.classList.add('badge');
				badge.textContent = tag.replace(/\_/g, ' ') + ' (' + MAP.tags[tag].length + ')';
				badge.onclick = function () { Piccolo.filterByTag(tag); };
				dialogTags.appendChild(badge);
			});
		},
		filterByTag: function (tag) {
			if (!window.MAP) {
				return;
			}
			$('.backdrop, .dialog, #main-loaded').hide();
			$('#main-loading').show();
			var $main = $('<main></main>'),// $('main').empty(),
				pics = MAP.tags[tag];
			if (!pics) {
				console.error('Tag "' + tag + '" not found!');
				return;
			}
			pics.sort(function (a, b) {
				return MAP.pics[a].timestamp > MAP.pics[b].timestamp ? -1 : 1;
			}).forEach(function (picID) {
				var lazy = true,
					pic = MAP.pics[picID],
					title = pic.path.substring(pic.path.lastIndexOf('/') + 1, pic.path.lastIndexOf('.')),
					$container = $('<div class="item" title="' + title + '" data-pic="' + picID + '"' + (lazy ? ' data-lazy' : '') + '></div>');
				if (!lazy) {
					$container.append(Piccolo.renderThumbnail(picID));
				}
				$main.append($container);
			});
			$('#main-loading').hide();
			$('main').replaceWith($main);
			Piccolo.processScroll();
			Piccolo.applyEventListener();
		},
		renderThumbnail: function (picID) {
			var ELEMENT_WIDTH = 150,
				ELEMENT_HEIGHT = 150,
				pic = MAP.pics[picID],
				ext = pic.path.substring(pic.path.lastIndexOf('.') + 1),
				element;
			if (['gif'].indexOf(ext) !== -1) {
				element = document.createElement('canvas');
				var context = element.getContext('2d'),
					img = new Image();
				img.onload = function () {
					element.height = ELEMENT_HEIGHT;
					element.width = ELEMENT_HEIGHT * img.width / img.height;
					context.drawImage(img, 0, 0, element.width, element.height);
				};
				img.src = pic.path;
			} else if (['webm', 'flv', 'mp4', 'mpg', 'mpeg', 'mov', 'avi'].indexOf(ext) !== -1) {
				element = document.createElement('video');
				element.autoplay = false;
				element.controls = false;
				element.loop = true;
				element.onmouseover = function () {
					element.play();
				};
				element.onmouseout = function () {
					element.pause();
				};
				element.src = pic.path;
			} else {
				element = new Image();
				element.src = pic.path;
			}
			element.height = ELEMENT_HEIGHT;
			return element;
		},
		applyEventListener: function () {
			$('.item', 'main').on('click', function () {
				var $item = $(this),
					picID = $item.data('pic'),
					pic = MAP.pics[picID],
					ext = pic.path.substring(pic.path.lastIndexOf('.') + 1),
					title = pic.path.substring(pic.path.lastIndexOf('/') + 1, pic.path.lastIndexOf('.'));
				if (['webm', 'flv', 'mp4', 'mpg', 'mpeg', 'mov', 'avi'].indexOf(ext) !== -1) {
					var video = document.createElement('video');
					video.autoplay = true;
					video.controls = true;
					video.loop = true;
					video.addEventListener('loadedmetadata', function () {
						if (video.videoHeight > window.innerHeight * 0.9) {
							video.style.maxHeight = '100%';
						}
						$('#dialog-pic-content').html(video);
					});
					video.setAttribute('title', title);
					video.src = pic.path;
					//$('#dialog-pic-content').html('<video src="' + pic.path + '" autoplay loop controls style="max-width: 100%; max-height: 100%" title="' + title + '"></video>');
				} else {
					var image = new Image();
					image.onload = function () {
						if (image.naturalHeight > window.innerHeight * 0.9) {
							image.style.maxHeight = '100%';
						}
						$('#dialog-pic-content').html(image);
					};
					image.setAttribute('title', title);
					image.src = pic.path;
				}
				$('.backdrop, #dialog-pic').show();
			});
		},
		isElementInViewport: function (element) {
			var rect = element.getBoundingClientRect()
			return (rect.top >= 0 && rect.left >= 0 && rect.top <= (window.innerHeight || document.documentElement.clientHeight));
		},
		processScroll: function () {
			[].forEach.call(document.querySelectorAll('[data-lazy]'), function (item) {
				if (Piccolo.isElementInViewport(item)) {
					item.removeAttribute('data-lazy');
					$(item).append(Piccolo.renderThumbnail($(item).data('pic')));
				}
			});
		}
	};

	window.Piccolo = Piccolo;
})();

$('#header-search').on('change', function () {
	Piccolo.filterByTag($(this).val().replace(/\s/g, '_'));
});

$('#header-showtags').on('click', function () {
	$('.backdrop, #dialog-tags').show();
});
$('#dialog-tags-close').on('click', function () {
	$('.backdrop, #dialog-tags').hide();
});

$('#header-load').on('click', function () {
	$('#header-load-file').click();
});

$('#header-load-file').on('change', function () {
	var file = $(this).get(0).files[0];
	Piccolo.loadMap(file);
});

/*
var dropbox = document.getElementById('dropbox');
dropbox.addEventListener("dragenter", function (e) {
	e.stopPropagation();
	e.preventDefault();
}, false);
dropbox.addEventListener("dragover", function (e) {
	e.stopPropagation();
	e.preventDefault();
}, false);
dropbox.addEventListener("drop", function (e) {
	e.stopPropagation();
	e.preventDefault();
	var file = e.dataTransfer.files[0];
	Piccolo.loadMap(file);
}, false);
*/

$('.backdrop').on('click', function () {
	$('.backdrop, .dialog').hide();
});

var debounce = function (func, wait, immediate) {
	var timeout;
	return function() {
		var context = this, args = arguments;
		var later = function() {
			timeout = null;
			if (!immediate) func.apply(context, args);
		};
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func.apply(context, args);
	};
};

var onwheel = debounce(function () {
	Piccolo.processScroll();
}, 250);

document.addEventListener('wheel', onwheel);
