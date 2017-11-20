(function () {

	var Piccolo = {
		loadMap: function (path) {
			$.ajax({
				type: 'GET',
				url: API_URL,
				data: 'action=map&path=' + encodeURIComponent(path),
			}).fail(function () {
				alert('Error');
			}).done(function (data) {
				if (data.status !== 'ok') {
					alert('Error');
				} else {
					MAP = data.map;
					Piccolo.updateTagList();
					$('#header-search, #header-tags, #header-random, #header-edit').prop('disabled', false);
					$('main').empty();
					$('#main-start').hide();
					$('#main-loaded').show();
				}
			});
		},
		updateTagList: function () {
			if (!window.MAP) {
				return;
			}
			var datalist = document.getElementById('datalist-tags');
			datalist.innerHTML = '';
			Object.keys(MAP.tags).sort().forEach(function (tag) {
				var option = document.createElement('option');
				option.value = tag;
				datalist.appendChild(option);
			});
		},
		filter: function (pics) {
			if (!window.MAP || !pics) {
				return;
			}
			$('#main-loaded').hide();
			$('#main-loading').show();
			var $main = $('<main></main>');// $('main').empty();
			pics.sort(function (a, b) {
				return MAP.pics[a].ts > MAP.pics[b].ts ? -1 : 1;
			}).forEach(function (picID) {
				var lazy = true,
					$container = $('<div class="item" data-pic="' + picID + '"' + (lazy ? ' data-lazy' : '') + '></div>');
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
		renderThumbnail: function (picID, $item) {
			var ELEMENT_WIDTH = 150,
				ELEMENT_HEIGHT = 150,
				pic = MAP.pics[picID],
				ext = pic.path.substring(pic.path.lastIndexOf('.') + 1),
				element;
			if (['gif'].indexOf(ext.toLowerCase()) !== -1) {
				element = document.createElement('canvas');
				var context = element.getContext('2d'),
					img = new Image();
				img.onload = function () {
					element.height = ELEMENT_HEIGHT;
					element.width = ELEMENT_HEIGHT * img.naturalWidth / img.naturalHeight;
					context.drawImage(img, 0, 0, element.width, element.height);
					element.setAttribute('title', img.naturalWidth + 'x' + img.naturalHeight + ' ' + pic.tags.join(' '));
					$item.width(element.width);
				};
				img.src = PIC_URL + encodeURIComponent(pic.path);
			} else if (['webm', 'flv', 'mp4', 'mpg', 'mpeg', 'mov', 'avi'].indexOf(ext.toLowerCase()) !== -1) {
				element = document.createElement('video');
				element.autoplay = false;
				element.controls = false;
				element.loop = true;
				element.muted = true;
				element.addEventListener('mouseover', function () {
					element.play();
				});
				element.addEventListener('mouseout', function () {
					element.pause();
				});
				element.addEventListener('loadedmetadata', function () {
					element.setAttribute('title', element.videoWidth + 'x' + element.videoHeight + ' ' + pic.tags.join(' '));
				});
				element.src = PIC_URL + encodeURIComponent(pic.path);
			} else {
				element = new Image();
				element.onload = function () {
					element.setAttribute('title', element.naturalWidth + 'x' + element.naturalHeight + ' ' + pic.tags.join(' '));
					$item.width(element.width);
				};
				element.src = PIC_URL + encodeURIComponent(pic.path);
			}
			element.height = ELEMENT_HEIGHT;
			return element;
		},
		applyEventListener: function () {
			$('main', '.item').on('click', function () {
				if (window.EDIT_MODE) {
					$(this).toggleClass('item-selected');
					return;
				}
				var $item = $(this),
					picID = $item.data('pic'),
					pic = MAP.pics[picID],
					ext = pic.path.substring(pic.path.lastIndexOf('.') + 1);
				if (['webm', 'flv', 'mp4', 'mpg', 'mpeg', 'mov', 'avi'].indexOf(ext.toLowerCase()) !== -1) {
					var video = document.createElement('video');
					video.autoplay = true;
					video.controls = true;
					video.loop = true;
					video.addEventListener('loadedmetadata', function () {
						video.setAttribute('title', video.videoWidth + 'x' + video.videoHeight + ' ' + pic.tags.join(' '));
						if (video.videoHeight > window.innerHeight * 0.9) {
							video.style.maxHeight = '100%';
						}
						$('#dialog-pic-content').html(video);
					});
					video.src = PIC_URL + encodeURIComponent(pic.path);
					//$('#dialog-pic-content').html('<video src="' + pic.path + '" autoplay loop controls style="max-width: 100%; max-height: 100%" title="' + title + '"></video>');
				} else {
					var image = new Image();
					image.onload = function () {
						image.setAttribute('title', image.naturalWidth + 'x' + image.naturalHeight + ' ' + pic.tags.join(' '));
						if (image.naturalHeight > window.innerHeight * 0.9) {
							image.style.maxHeight = '100%';
						}
						$('#dialog-pic-content').html(image);
					};
					image.src = PIC_URL + encodeURIComponent(pic.path);
				}
				var $footer = $('#dialog-pic-footer').empty();
				pic.tags.forEach(function (tag) {
					var $badge = $('<div class="badge"></div>');
					$badge.text(tag.replace(/\_/g, ' ') + ' (' + MAP.tags[tag].length + ')');
					$badge.on('click', function () {
						Piccolo.filter(MAP.tags[tag]);
					});
					$footer.append($badge);
				});
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
					var element = Piccolo.renderThumbnail($(item).data('pic'), $(item));
					$(item).append(element);
				}
			});
		},
		debounce: function (func, wait, immediate) {
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
		}
	};

	window.Piccolo = Piccolo;
})();

var API_URL = (location.origin || location.href) + '/api';
var PIC_URL = (location.origin || location.href) + '/pic?path=';
var BASE_PATH = null;
var MAP = null;

$('#header-load').on('click', function () {
	var path = prompt('Insert absolute path:', BASE_PATH || undefined);
	if (path) {
		BASE_PATH = path;
		Piccolo.loadMap(BASE_PATH);
	}
});

$('#header-random').on('click', function () {
	var pics = [],
		picsHash = Object.keys(MAP.pics);
	for (var i = 0; i < 30; ++i) {
		pics.push(picsHash[Math.floor(Math.random() * picsHash.length)]);
	}
	Piccolo.filter(pics);
});

$('#header-search').on('change', function () {
	Piccolo.filter(MAP.tags[$(this).val()]);
});

var onwheel = Piccolo.debounce(function () {
	Piccolo.processScroll();
}, 250);
document.addEventListener('wheel', onwheel);

/*

$('#header-edit').on('click', function () {
	if (window.EDIT_MODE) {
		delete window.EDIT_MODE;
		$('#toolbar').hide();
	} else {
		window.EDIT_MODE = true;
		$('#toolbar').show();
	}
});

$('#toolbar-tags').on('input', function () {
	if ($(this).val() === '') {
		$('#toolbar-add, #toolbar-remove').prop('disabled', true);
	} else {
		$('#toolbar-add, #toolbar-remove').prop('disabled', false);
	}
});

var commands = [];
$('#toolbar-add').on('click', function () {
	var tags = $('#toolbar-tags').val().replace(/\s/g, '_');
	$('.item-selected').each(function () {
		var picID = $(this).data('pic'),
			pic = MAP.pics[picID];
		if (pic) {
			commands.push({ command: 'add', path: pic.path, tags: tags });
		}
		$(this).removeClass('item-selected');
	});
	$('#toolbar-tags').val('');
});

$('#toolbar-remove').on('click', function () {
	var tags = $('#toolbar-tags').val().replace(/\s/g, '_');
	$('.item-selected').each(function () {
		var picID = $(this).data('pic'),
			pic = MAP.pics[picID];
		if (pic) {
			commands.push({ command: 'remove', path: pic.path, tags: tags });
		}
		$(this).removeClass('item-selected');
	});
	$('#toolbar-tags').val('');
});

$('#toolbar-delete').on('click', function () {
	var $selected = $('.item-selected');
	if ($selected.length > 0) {
		if (confirm('Are you sure to delete the ' + $selected.length + ' selected pictures?')) {
			$selected.each(function () {
				var picID = $(this).data('pic'),
					pic = MAP.pics[picID];
				if (pic) {
					commands.push({ command: 'delete', path: pic.path });
				}
				$(this).removeClass('item-selected');
			});
		}
	}
});

var exportCommands = function (scriptpath) {
	var piccolopath = scriptpath || 'piccolo.js',
		output = '';
	commands.sort(function (a, b) {
		var order = ['remove', 'add', 'delete'];
		return order.indexOf(a.command) < order.indexOf(b.command) ? -1 : 1;
	}).forEach(function (command) {
		if (command.command === 'delete') {
			output += 'rm "' + command.path + '"\n';
		} else if (command.command === 'add') {
			output += 'node ' + piccolopath + ' -a=' + command.tags + ' "' + command.path + '"\n';
		} else if (command.command === 'remove') {
			output += 'node ' + piccolopath + ' -d=' + command.tags + ' "' + command.path + '"\n';
		}
	});
	commands = [];
	console.info(output);
};

*/

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
