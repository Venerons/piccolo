const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const child_process = require('child_process');

var getopt = function (argv_array) {
	let options = {};
	process.argv.forEach(function (item) {
		var result = item.match(/^\-?\-(\w+)=\"?([^\"]+)\"?$/);
		if (result) {
			options[result[1]] = result[2];
		}
	});
	return options;
};

const options = getopt(process.argv);
const PICS_PATH = options.path || null;
const HOSTNAME = options.hostname || '127.0.0.1';
const PORT = options.port && !isNaN(parseInt(options.port, 10)) ? parseInt(options.port, 10) : '8080';
const PASSWORD = options.password || null;

console.log('');
console.log(`PICS_PATH\t${PICS_PATH}`);
console.log(`HOSTNAME\t${HOSTNAME}`);
console.log(`PORT\t\t${PORT}`);
console.log(`PASSWORD\t${PASSWORD}`);
console.log('');

if (!PICS_PATH) {
	console.error('Error: missing "path" parameter.');
	console.log('Usage:\nnode piccolo.js --path="<pics_path>" [--hostname="<ip_address>"] [--port="<logical_port>"] [--password="<password>"]');
	return;
}
if (!path.isAbsolute(PICS_PATH)) {
	PICS_PATH = path.resolve(PICS_PATH);
}

//###############################################

const MIME_TYPE_MAP = {
	'.html': 'text/html',
	'.js': 'application/javascript',
	'.json': 'application/json',
	'.css': 'text/css',
	'.bmp': 'image/bmp',
	'.gif': 'image/gif',
	'.ief': 'image/ief',
	'.iefs': 'image/ief',
	'.jpeg': 'image/jpeg',
	'.jpg': 'image/jpeg',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.tif': 'image/tiff',
	'.tiff': 'image/tiff',
	'.webm': 'video/webm'
};

// https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
const HTTP_ERROR_MAP = {
	'100': 'Continue',
	'101': 'Switching Protocols',
	'103': 'Early Hints',
	'200': 'OK',
	'201': 'Created',
	'202': 'Accepted',
	'203': 'Non-Authoritative Information',
	'204': 'No Content',
	'205': 'Reset Content',
	'206': 'Partial Content',
	'300': 'Multiple Choices',
	'301': 'Moved Permanently',
	'302': 'Found',
	'303': 'See Other',
	'304': 'Not Modified',
	'307': 'Temporary Redirect',
	'308': 'Permanent Redirect',
	'400': 'Bad Request',
	'401': 'Unauthorized',
	'402': 'Payment Required',
	'403': 'Forbidden',
	'404': 'Not Found',
	'405': 'Method Not Allowed',
	'406': 'Not Acceptable',
	'407': 'Proxy Authentication Required',
	'408': 'Request Timeout',
	'409': 'Conflict',
	'410': 'Gone',
	'411': 'Length Required',
	'412': 'Precondition Failed',
	'413': 'Payload Too Large',
	'414': 'URI Too Long',
	'415': 'Unsupported Media Type',
	'416': 'Range Not Satisfiable',
	'417': 'Expectation Failed',
	'418': 'I\'m a teapot',
	'422': 'Unprocessable Entity',
	'425': 'Too Early',
	'426': 'Upgrade Required',
	'428': 'Precondition Required',
	'429': 'Too Many Requests',
	'431': 'Request Header Fields Too Large',
	'451': 'Unavailable For Legal Reasons',
	'500': 'Internal Server Error',
	'501': 'Not Implemented',
	'502': 'Bad Gateway',
	'503': 'Service Unavailable',
	'504': 'Gateway Timeout',
	'505': 'HTTP Version Not Supported',
	'506': 'Variant Also Negotiates',
	'507': 'Insufficient Storage',
	'508': 'Loop Detected',
	'510': 'Not Extended',
	'511': 'Network Authentication Required'
}


//###############################################

var humanize_size = function (bytes, decimals = 2) {
	if (bytes === 0) {
		return '0 Bytes';
	}
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

var humanize_time = function (milliseconds) {
	let number_ending = function (number) {
		return (number > 1) ? 's' : '';
	};
	let temp = Math.floor(milliseconds / 1000),
		years = Math.floor(temp / 31536000);
	if (years) {
		return years + ' year' + number_ending(years);
	}
	//TODO: Months! Maybe weeks? 
	let days = Math.floor((temp %= 31536000) / 86400);
	if (days) {
		return days + ' day' + number_ending(days);
	}
	let hours = Math.floor((temp %= 86400) / 3600);
	if (hours) {
		return hours + ' hour' + number_ending(hours);
	}
	let minutes = Math.floor((temp %= 3600) / 60);
	if (minutes) {
		return minutes + ' minute' + number_ending(minutes);
	}
	let seconds = temp % 60;
	if (seconds) {
		return seconds + ' second' + number_ending(seconds);
	}
	return 'less than a second'; // 'just now' or other string you like
};

var tag_sorting = function (a, b) {
	if (/^[0-9a-f]{32}$/g.test(a)) {
		return -1;
	} else if (/^[0-9a-f]{32}$/g.test(b)) {
		return 1;
	} else if (a.toLowerCase() < b.toLowerCase()) {
		return -1;
	} else if (a.toLowerCase() > b.toLowerCase()) {
		return 1;
	} else if (a < b) {
		return -1;
	} else if (a > b) {
		return 1;
	} else {
		return 0;
	}
};

var get_files_list = function () {
	let files_list = [],
		count = 0;
	try {
		let root_files = fs.readdirSync(PICS_PATH, { withFileTypes: true });
		root_files.forEach(function (root_item) {
			if (root_item.name !== 'thumb' && root_item.name.charAt(0) !== '.') {
				const root_file_path = path.resolve(PICS_PATH, root_item.name);
				if (root_item.isFile()) {
					files_list.push(root_file_path);
					process.stdout.clearLine();
					process.stdout.cursorTo(0);
					process.stdout.write(`Listed file #${++count}`);
				} else if (root_item.isDirectory()) {
					let subdir_files = fs.readdirSync(root_file_path, { withFileTypes: true });
					subdir_files.forEach(function (subdir_item) {
						if (subdir_item.name.charAt(0) !== '.') {
							const subdir_file_path = path.resolve(root_file_path, subdir_item.name);
							if (subdir_item.isFile()) {
								files_list.push(subdir_file_path);
								process.stdout.clearLine();
								process.stdout.cursorTo(0);
								process.stdout.write(`Listed file #${++count}`);
							}
						}
					});
				}
			}
		});
	} catch (error) {
		console.error(error);
	}
	process.stdout.write(`\n`);
	return files_list;
};

var get_cache = function (files_list) {
	let cache = new Map();
	let count_cached = 0;
	let count_skipped = 0;
	files_list.forEach(function (file_path) {
		let pic_ext = path.extname(file_path),
			tokens = path.basename(file_path, pic_ext).split(' '),
			pic_id = tokens[0] && tokens[0].match(/^[0-9a-f]{32}$/) ? tokens[0] : null;
		if (tokens.includes(pic_id)) {
			tokens.splice(tokens.indexOf(pic_id), 1);
		}
		if (!pic_id) {
			count_skipped++;
		} else {
			let info = {
				id: pic_id,
				path: file_path,
				tags: tokens,
				ext: pic_ext
			};
			cache.set(info.id, info);
			process.stdout.clearLine();
			process.stdout.cursorTo(0);
			process.stdout.write(`Cached file ${++count_cached} / ${files_list.length}`);
		}
	});
	process.stdout.write(`\n`);
	if (count_skipped > 0) {
		console.log(`Skipped ${count_skipped} id-less files.`);
	}
	return cache;
};

var rehash = function (files_list) {
	const timestamp = Date.now();
	let count_done = 0;
	let count_duplicate = 0;
	let hash_map = Object.create(null);
	files_list.forEach(function (file_path) {
		let pic_ext = path.extname(file_path),
			tokens = path.basename(file_path, pic_ext).split(' '),
			pic_id = tokens[0] && tokens[0].match(/^[0-9a-f]{32}$/) ? tokens[0] : null;
		if (tokens.includes(pic_id)) {
			tokens.splice(tokens.indexOf(pic_id), 1);
		}
		let pic = {
			id: pic_id,
			path: file_path,
			tags: tokens,
			ext: pic_ext.toLowerCase()
		};
		if (!pic.id) {
			// file doesn't have ID
			pic.id = crypto.createHash('md5').update(fs.readFileSync(file_path)).digest('hex');
		}
		if (!hash_map[pic.id]) {
			// no duplicate found
			hash_map[pic.id] = pic;
		} else {
			// duplicate found
			pic.tags.forEach(function (tag) {
				tag = tag.trim();
				if (tag !== '' && !(/(^[0-9no\-_\.]+$|^IMG|^DSC|^Screenshot|^Schermata)/g.test(tag))) {
					if (!hash_map[pic.id].tags.includes(tag)) {
						hash_map[pic.id].tags.push(tag);
					}
				}
			});
			try {
				fs.unlinkSync(file_path);
				count_duplicate++;
			} catch (error) {
				console.error('\n', error);
			}
		}
		count_done++;
		process.stdout.clearLine();
		process.stdout.cursorTo(0);
		process.stdout.write(`${count_done}/${files_list.length} (${Math.floor((count_done) * 100 / files_list.length)}%) - ${count_duplicate} duplicates removed`);
	});
	process.stdout.write('\n');
	count_done = 0;
	let hash_array = Object.keys(hash_map);
	hash_array.forEach(function (hash) {
		const pic = hash_map[hash];
		const file_name = `${pic.id}${pic.tags.length > 0 ? ` ${pic.tags.sort(tag_sorting).join(' ')}` : ''}${pic.ext}`;
		if (file_name.length > 255) {
			file_name = `${pic.id}${pic.ext}`;
		}
		const new_file_path = path.resolve(PICS_PATH, pic.ext.substring(1), file_name);
		try {
			fs.accessSync(path.resolve(PICS_PATH, pic.ext.substring(1)), fs.constants.F_OK);
		} catch (error) {
			fs.mkdirSync(path.resolve(PICS_PATH, pic.ext.substring(1)), { recursive: true });
		}
		if (new_file_path !== pic.path) {
			try {
				fs.renameSync(pic.path, new_file_path);
			} catch (error) {
				console.error('\n', error);
			}
		}
		count_done++;
		process.stdout.clearLine();
		process.stdout.cursorTo(0);
		process.stdout.write(`${count_done}/${hash_array.length} (${Math.floor((count_done) * 100 / hash_array.length)}%)`);
	});
	process.stdout.write('\n');
	console.log(`Rehash completed in ${Date.now() - timestamp} seconds (${humanize_time(Date.now() - timestamp)}).`);
};

//###############################################

var FFMPEG_AVAILABLE = false;
try {
	child_process.execSync('ffmpeg -version');
	FFMPEG_AVAILABLE = true;
	console.error('ffmpeg available.');
} catch (e) {
	console.error('ffmpeg NOT available.');
}
try {
	fs.accessSync(path.resolve(PICS_PATH, 'thumb'), fs.constants.F_OK);
} catch (error) {
	fs.mkdirSync(path.resolve(PICS_PATH, 'thumb'), { recursive: true });
}
var CACHE = get_cache(get_files_list());

/*
fs.writeFile('/tmp/piccolo.cache', JSON.stringify(CACHE), function (error) {
	if (error) {
		console.error(error);
	}
});
*/

//###############################################

const server = http.createServer(function (request, response) {
	console.log(`${request.method}\t${request.url}`);
	//console.log('request.httpVersion', request.httpVersion);
	//console.log('request.headers', request.headers);

	request.on('error', (error) => {
		console.error(`Error: catched request error. Request: ${request.method} ${request.url}`);
		console.error(error);
	});

	response.on('error', (error) => {
		console.error(`Error: catched response error. Request: ${request.method} ${request.url}`);
		console.error(error);
	});

	var http_return_file = function (http_code, file_path) {
		//console.log(`http_return_file: ${file_path}`);
		fs.stat(file_path, function (error, stats) {
			if (error) {
				http_return_json(404);
			} else {
				const mime = MIME_TYPE_MAP[path.extname(file_path)];
				if (request.headers.range) {
					//console.log(`request.headers.range: ${request.headers.range}`);
					const parts = request.headers.range.replace(/bytes=/, '').split('-');
					const start = parseInt(parts[0], 10);
					const end = parts[1] !== '' ? parseInt(parts[1], 10) : stats.size - 1;
					/*
					let end = parts[1] !== '' ? parseInt(parts[1], 10) : null;
					if (!end) {
						end = start + 5242880 > stats.size - 1 ? stats.size - 1 : start + 5242880;
					}
					*/
					const chunksize = (end - start) + 1;
					//console.log(`start: ${start} - end: ${end} - chunksize: ${chunksize} (${humanize_size(chunksize)}) - stats.size: ${stats.size} (${humanize_size(stats.size)})`);
					response.statusCode = 206;
					response.statusMessage = 'Partial Content';
					if (mime) {
						response.setHeader('Content-Type', mime);
					}
					response.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
					response.setHeader('Accept-Ranges', 'bytes');
					response.setHeader('Content-Length', chunksize);
					const stream = fs.createReadStream(file_path, { start: start, end: end });
					stream.pipe(response);
					stream.on('end', function () {
						response.end();
					});
				} else {
					response.statusCode = http_code;
					response.statusMessage = HTTP_ERROR_MAP[http_code.toString()] || 'Unknown';
					if (mime) {
						response.setHeader('Content-Type', mime);
					}
					response.setHeader('Content-Length', stats.size);
					const stream = fs.createReadStream(file_path);
					stream.pipe(response);
					stream.on('end', function () {
						response.end();
					});
				}
			}
		});
	};

	var http_return_json = function (http_code, json) {
		//console.log(`http_return_json: ${http_code}`);
		response.statusCode = http_code;
		response.statusMessage = HTTP_ERROR_MAP[http_code.toString()] || 'Unknown';
		if (json) {
			response.setHeader('Content-Type', 'application/json');
			response.write(JSON.stringify(json) + '\n');
		}
		response.end();
	};

	//const parsed_url = new URL(request.url, `http://${request.headers.host}`);

	/*
	let body = [];
	request.on('data', function (chunk) {
		body.push(chunk);
	}).on('end', function () {
		body = JSON.parse(Buffer.concat(body).toString());
		// do stuff
	});
	*/

	if (request.url === '' || request.url === '/') {

		const file_path = path.resolve(__dirname, 'ui/index.html');
		http_return_file(200, file_path);

	} else if (request.url.match(/^\/ui\/.+/)) {

		const parsed_url = new URL(`http://${HOSTNAME}:${PORT}${request.url}`);
		const file_path = path.resolve(__dirname, parsed_url.pathname.substring(1));
		http_return_file(200, file_path);

	} else if (request.url.match(/^\/api\/.+/)) {

		if (PASSWORD && !request.url.match(/^\/api\/pic\/[0-9a-f]{32}\/raw$/) && !request.url.match(/^\/api\/pic\/[0-9a-f]{32}\/thumbnail$/)) {
			const authorization = request.headers.authorization ? request.headers.authorization.match(/^Basic (.+)$/) : null;
			if (!authorization) {
				http_return_json(401);
				return;
			}
			const buff = Buffer.from(authorization[1], 'base64');
			const text = buff.toString('utf8');
			if (text !== `piccolo:${PASSWORD}`) {
				http_return_json(401);
				return;
			}
		}

		if (request.url.match(/^\/api\/auth$/)) {

			if (request.method === 'GET') {
				// GET /api/auth
				// check authentication
				http_return_json(200);
			} else {
				http_return_json(405);
			}

		} else if (request.url.match(/^\/api\/pic\/random$/)) {

			// /api/pic/random

			if (request.method === 'GET') {
				const pics_list = Array.from(CACHE.keys());
				let pic_id = pics_list[Math.floor(Math.random() * pics_list.length)];
				const pic = CACHE.get(pic_id);
				let pic_info = JSON.parse(JSON.stringify(pic));
				delete pic_info.path;
				http_return_json(200, pic_info);
			} else {
				http_return_json(405);
			}

		} else if (request.url.match(/^\/api\/pic\/[0-9a-f]{32}$/)) {

			// /api/pic/<id>

			let tokens = request.url.match(/^\/api\/pic\/([0-9a-f]{32})$/),
				pic_id = tokens && tokens[1] ? tokens[1] : null,
				pic = CACHE.get(pic_id);
			if (!pic) {
				http_return_json(404);
				return;
			}

			if (request.method === 'GET') {
				let pic_info = JSON.parse(JSON.stringify(pic));
				delete pic_info.path;
				http_return_json(200, pic_info);
			} else if (request.method === 'POST') {
				let body = [];
				request.on('data', function (chunk) {
					body.push(chunk);
				}).on('end', function () {
					body = JSON.parse(Buffer.concat(body).toString());
					const file_name = `${pic.id}${body.tags.length > 0 ? ` ${body.tags.sort(tag_sorting).join(' ')}` : ''}${pic.ext}`
					if (file_name.length > 255) {
						http_return_json(500);
					} else if (file_name === path.basename(pic.path)) {
						http_return_json(304);
					} else {
						const original_file_path = path.normalize(pic.path);
						const new_file_path = path.resolve(path.dirname(pic.path), file_name);
						fs.rename(original_file_path, new_file_path, function (error) {
							if (error) {
								console.error('Error renaming file', error);
								http_return_json(500);
							} else {
								pic.path = new_file_path;
								pic.tags = body.tags;
								//console.log(`Renamed file ${original_file_path} -> ${new_file_path}`);
								http_return_json(200);
							}
						});
					}
				});
			} else if (request.method === 'DELETE') {
				const thumbnail_path = path.resolve(PICS_PATH, 'thumb', `${pic.id}.jpeg`);
				fs.unlink(thumbnail_path, function (error) {
					if (error) {
						//console.error('Error unlinking file thumbnail', error);
					}
				});
				fs.unlink(pic.path, function (error) {
					if (error) {
						console.error('Error unlinking file', error);
						http_return_json(500);
					} else {
						CACHE.delete(pic_id);
						http_return_json(200);
					}
				});
			} else {
				http_return_json(405);
			}

		} else if (request.url.match(/^\/api\/pic\/[0-9a-f]{32}\/thumb$/)) {

			// /api/pic/<id>/thumb

			let tokens = request.url.match(/^\/api\/pic\/([0-9a-f]{32})\/thumb$/),
				pic_id = tokens && tokens[1] ? tokens[1] : null,
				pic = CACHE.get(pic_id);
			if (!pic) {
				http_return_json(404);
				return;
			}

			if (request.method === 'GET') {
				const thumb_dir_path = path.resolve(PICS_PATH, 'thumb');
				const thumbnail_path = path.resolve(thumb_dir_path, `${pic.id}.jpeg`);
				fs.access(thumbnail_path, fs.constants.F_OK, function (error) {
					if (!error) {
						http_return_file(200, thumbnail_path);
					} else {
						if (!FFMPEG_AVAILABLE) {
							console.error(`Error: cannot access ${thumbnail_path}`, error);
							http_return_json(404);
						} else if (pic.ext === '.heic') {
							http_return_json(404);
						} else {
							//console.log(`Generating thumbnail ${thumbnail_path}`);
							/*
							https://superuser.com/questions/538112/meaningful-thumbnails-for-a-video-using-ffmpeg
							https://stackoverflow.com/questions/27145238/create-thumbnail-from-video-using-ffmpeg
							https://superuser.com/questions/602315/ffmpeg-thumbnails-with-exact-size-main-aspect-ratio
							https://stackoverflow.com/questions/15974243/resize-to-a-specific-width-and-height-using-ffmpeg
							https://stackoverflow.com/questions/14551102/with-ffmpeg-create-thumbnails-proportional-to-the-videos-ratio/14551281
							*/
							//child_process.exec(`ffmpeg -hide_banner -loglevel error -i "${pic.path}" -vf "thumbnail,scale=max(150\\,a*150):max(150\\,150/a)" -frames:v 1 "${thumbnail_path}"`, function (error) {
							const is_video = ['.webm', '.flv', '.mp4', '.mpg', '.mpeg', '.mov', '.avi'].includes(pic.ext);
							child_process.exec(`ffmpeg -hide_banner -loglevel error${is_video ? ' -ss 00:00:03 -noaccurate_seek' : ''} -i "${pic.path}" -vf "thumbnail,scale=max(150\\,a*150):max(150\\,150/a),crop=150:150" -frames:v 1 "${thumbnail_path}"`, function (error, stdout, stderr) {
								if (!error) {
									http_return_file(200, thumbnail_path);
								} else {
									console.error(`Error: cannot create thumbnail`);
									console.error(error);
									console.error(stderr);
									http_return_json(500);
								}
							});
						}
					}
				});
			} else {
				http_return_json(405);
			}

		} else if (request.url.match(/^\/api\/pic\/[0-9a-f]{32}\/raw$/)) {

			let tokens = request.url.match(/^\/api\/pic\/([0-9a-f]{32})\/raw$/),
				pic_id = tokens && tokens[1] ? tokens[1] : null,
				pic = CACHE.get(pic_id);
			if (!pic) {
				http_return_json(404);
				return;
			}

			if (request.method === 'GET') {
				// GET /api/pic/<id>/raw
				// return raw data file of pic <id>
				http_return_file(200, pic.path);
			} else {
				http_return_json(405);
			}

		} else if (request.url.match(/^\/api\/tag$/)) {

			if (request.method === 'GET') {
				// GET /api/tag
				// return all tags info (without pics list, only count)
				let map = {};
				CACHE.forEach(function (pic, pic_id) {
					if (pic.tags) {
						pic.tags.forEach(function (tag_label) {
							if (map[tag_label]) {
								map[tag_label] += 1;
							} else {
								map[tag_label] = 1;
							}
						});
					}
				});
				let tags = [];
				Object.keys(map).forEach(function (tag_label) {
					tags.push({
						label: tag_label,
						count: map[tag_label]
					});
				});
				http_return_json(200, { tags: tags });
			} else {
				http_return_json(405);
			}

		} else if (request.url.match(/^\/api\/tag\/[\w\'\èéàùòì\.\-\(\)\?]+$/)) {

			if (request.method === 'GET') {
				// GET /api/tag/<tag_id>
				// return tag info (with pics list)
				let tokens = request.url.match(/^\/api\/tag\/([\w\'\èéàùòì\.\-\(\)\?]+)$/),
					tag_label = tokens && tokens[1] ? tokens[1] : null;
				if (!tag_label) {
					http_return_json(404);
				} else {
					let filtered_pics = [];
					CACHE.forEach(function (pic, pic_id) {
						if (pic && pic.tags && pic.tags.includes(tag_label)) {
							filtered_pics.push(pic);
						}
					});
					if (filtered_pics.length === 0) {
						http_return_json(404);
					} else {
						let tag_info = {
							label: tag_label,
							count: filtered_pics.length,
							pics: []
						};
						filtered_pics.forEach(function (pic) {
							let pic_info = JSON.parse(JSON.stringify(pic));
							delete pic_info.path;
							tag_info.pics.push(pic_info);
						});
						http_return_json(200, tag_info);
					}
				}
			} else {
				http_return_json(405);
			}

		} else if (request.url.match(/^\/api\/rehash$/)) {

			if (request.method === 'POST') {
				// POST /api/rehash
				// rehash and remix entire database
				rehash(get_files_list());
				CACHE.clear();
				CACHE = get_cache(get_files_list());
				http_return_json(200);
			} else {
				http_return_json(405);
			}

		} else {
			http_return_json(501);
		}

	} else {
		http_return_json(501);
	}
});

server.listen(PORT, HOSTNAME, () => {
	console.log(`\nServer running at http://${HOSTNAME}:${PORT}/\nCTRL + C to shutdown\n`);
});
