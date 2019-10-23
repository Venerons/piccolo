/*jshint esversion: 6 */

// node piccolo.js <PICS_PATH> <PORT>

// Examples:
// node piccolo.js "/home/Admin/Images"
// node piccolo.js "/home/Admin/Images" 8080

const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROTOCOL = 'http://';
const HOSTNAME = '127.0.0.1';
const PORT = process.argv[3] ? parseInt(process.argv[3], 10) : 3000;
const PICS_PATH = process.argv[2];

// MIME TYPE MAP

var MIME_TYPE_MAP = {};
fs.readFile(path.resolve(__dirname, 'mime-map.json'), 'UTF-8', function (error, file) {
	if (error) {
		console.error('Warning: mime-map.json loading failed');
	} else {
		MIME_TYPE_MAP = JSON.parse(file);
	}
});

// HTTP SERVER

const server = http.createServer((request, response) => {
	//console.log('request.httpVersion', request.httpVersion);
	//console.log('request.method', request.method);
	//console.log('request.url', request.url);
	//console.log('request.headers', request.headers);
	console.log(request.method, request.url);

	request.on('error', (err) => {
		console.error(err.stack);
		http_return_error(response, 500);
	});

	response.on('error', (err) => {
		console.error(err.stack);
	});

	const parsed_url = new URL(`${PROTOCOL}${HOSTNAME}:${PORT}${request.url}`);

	/*
	let tokens = parsed_url.pathname.split('/');

	if (parsed_url.pathname === '' || parsed_url.pathname === '/') {

		// REQUEST: /
		// return index file

		let filepath = path.resolve(__dirname, 'index.html');
		http_return_file(response, filepath);

	} else if (tokens[1] === 'tags') {

		const tag_id = tokens[2];
		if (!tag_id) {

			// REQUEST: /tags
			// list tags

			let files_list = list_files(PICS_PATH);
			http_return_json(response, { status: 'ok', tags: list_tags(files_list) });

		} else {

			const action = tokens[3];
			if (!action) {

				// REQUEST: /tags/<id>
				// list pics containing this tag

				// TODO

			} if (action === 'remove') {

				// REQUEST: /tags/<id>/remove
				// remove tag, removing it from any pic

				// TODO

			} else if (action === 'edit') {

				// REQUEST: /tags/<id>/edit
				// edit (rename) tag, replacing it from any pic

				// TODO

			}
		}

	} else if (tokens[1] === 'pics') {

		const pic_id = tokens[2];
		if (!pic_id) {

			// REQUEST: /pics
			// list all pics

			// TODO

		} else if (pic_id === 'random') {

			// REQUEST: /pics/random
			// list random pics

			let files_list = list_files(PICS_PATH),
				random_files_list = random_files(files_list);
			http_return_json(response, { status: 'ok', pics: list_pics(random_files_list) });

		} else if (pic_id === 'rehash') {

			// REQUEST: /pics/rehash
			// rehash and remix all pics

			let files_list = list_files(PICS_PATH);
			rehash_files(files_list);
			files_list = list_files(PICS_PATH);
			remix_files(files_list);
			http_return_json(response, { status: 'ok' });

		} else if (pic_id === 'upload') {

			// REQUEST: /pics/upload
			// upload a pic

			let body = [];
			request.on('data', (chunk) => {
				body.push(chunk);
			}).on('end', () => {
				body = Buffer.concat(body).toString();
				// at this point, `body` has the entire request body stored in it as a string
				http_return_json(response, { status: 'ok' });
			});

		} else {

			const action = tokens[3];
			if (!action) {

				// REQUEST: /pics/<id>
				// serve pic file

				let filepath = get_pic_path(pic_id);
				if (!filepath) {
					http_return_error(response, 404);
				} else {
					http_return_file(response, filepath);
				}

			} else if (action === 'remove') {

				// REQUEST: /pics/<id>/remove
				// remove pic

				let pics = [pic_id];
				if (pics.length > 0) {
					let complete_files_list = list_files(PICS_PATH),
						files_list = [];
					pics.forEach(function (pic_id) {
						let file_path = get_pic_path(pic_id, complete_files_list);
						if (file_path) {
							files_list.push(file_path);
						}
					});
					remove_pics(files_list);
				}
				http_return_json(response, { status: 'ok' });

			} else if (action === 'edit') {

				// REQUEST: /pics/<id>/edit
				// edit pic

				// TODO

			}
		}

	} else {

		// REQUEST: fs server
		// serve file

		let filepath = path.resolve(__dirname, parsed_url.pathname.substring(1));
		http_return_file(response, filepath);

	}
	*/

	if (parsed_url.pathname === '/api') {

		// API

		const action = parsed_url.searchParams.get('action');
		if (!action) {

			// MISSING ACTION PARAMETER

			http_return_json(response, { status: 'error', error: 'INVALID_REQUEST' });

		} else if (action === 'rehash') {

			// REHASH - ?action=rehash

			let files_list = list_files(PICS_PATH);
			rehash_files(files_list);
			files_list = list_files(PICS_PATH);
			remix_files(files_list);
			http_return_json(response, { status: 'ok' });

		} else if (action === 'list_tags') {

			// LIST TAGS - ?action=list_tags

			let files_list = list_files(PICS_PATH);
			http_return_json(response, { status: 'ok', tags: list_tags(files_list) });

		} else if (action === 'list_pics') {

			// LIST PICS - ?action=list_pics&tags=<tags>

			const request_tags = parsed_url.searchParams.get('tags');
			let files_list = list_files(PICS_PATH),
				tags = request_tags ? JSON.parse(request_tags) : null;
			http_return_json(response, { status: 'ok', pics: list_pics(files_list, tags) });

		} else if (action === 'edit_pics') {

			// EDIT PICS - ?action=edit_pics&pics=<pics>&tags=<tags>

			const request_pics = parsed_url.searchParams.get('pics');
			const request_tags = parsed_url.searchParams.get('tags');
			if (!(request_pics && request_tags)) {
				http_return_json(response, { status: 'error', error: 'INVALID_REQUEST' });
			} else {
				let pics = request_pics ? JSON.parse(request_pics) : [];
				if (pics.length > 0) {
					let complete_files_list = list_files(PICS_PATH),
						files_list = [];
					pics.forEach(function (pic_id) {
						let file_path = get_pic_path(pic_id, complete_files_list);
						if (file_path) {
							files_list.push(file_path);
						}
					});
					let tags = request_tags ? JSON.parse(request_tags) : [];
					if (tags.length > 0) {
						edit_pics(files_list, tags);
					}
				}
				http_return_json(response, { status: 'ok' });
			}

		} else if (action === 'remove_pics') {

			// REMOVE PICS - ?action=remove_pics&pics=<pics>

			const request_pics = parsed_url.searchParams.get('pics');
			if (!request_pics) {
				http_return_json(response, { status: 'error', error: 'INVALID_REQUEST' });
			} else {
				let pics = request_pics ? JSON.parse(request_pics) : [];
				if (pics.length > 0) {
					let complete_files_list = list_files(PICS_PATH),
						files_list = [];
					pics.forEach(function (pic_id) {
						let file_path = get_pic_path(pic_id, complete_files_list);
						if (file_path) {
							files_list.push(file_path);
						}
					});
					remove_pics(files_list);
				}
				http_return_json(response, { status: 'ok' });
			}

		} else if (action === 'random_pics') {

			// RANDOM PICS - ?action=random_pics

			let files_list = list_files(PICS_PATH),
				random_files_list = random_files(files_list);
			http_return_json(response, { status: 'ok', pics: list_pics(random_files_list) });

		} else if (action === 'upload_pics') {

			// UPLOAD PICS - ?action=upload_pics

			let body = [];
			request.on('data', (chunk) => {
				body.push(chunk);
			}).on('end', () => {
				body = Buffer.concat(body).toString();
				// at this point, `body` has the entire request body stored in it as a string
				http_return_json(response, { status: 'ok' });
			});

		} else {

			// INVALID ACTION

			http_return_json(response, { status: 'error', error: 'INVALID_REQUEST' });

		}

	} else if (parsed_url.pathname === '/pic') {

		// PIC
		const request_id = parsed_url.searchParams.get('id');
		if (!request_id) {
			http_return_error(response, 404);
		} else {
			let filepath = get_pic_path(request_id);
			if (!filepath) {
				http_return_error(response, 404);
			} else {
				http_return_file(response, filepath);
			}
		}

	} else {

		// FS SERVER
		let filepath = path.resolve(__dirname, parsed_url.pathname === '/' ? 'index.html' : parsed_url.pathname.substring(1));
		http_return_file(response, filepath);

	}

	console.log('\n---\n');
});

server.listen(PORT, HOSTNAME, () => {
	console.log(`Server running at ${PROTOCOL}${HOSTNAME}:${PORT}/\nCTRL + C to shutdown\n\n===\n`);
});

var http_return_error = function (response, code) {
	let message = 'Unknown Error';
	if (code === 200) {
		message = 'OK';
	} else if (code === 206) {
		message = 'Partial Content';
	} else if (code === 301) {
		message = 'Moved Permanently';
	} else if (code === 302) {
		message = 'Found';
	} else if (code === 304) {
		message = 'Not Modified';
	} else if (code === 400) {
		message = 'Bad Request';
	} else if (code === 403) {
		message = 'Forbidden';
	} else if (code === 404) {
		message = 'Not Found';
	} else if (code === 405) {
		message = 'Method Not Allowed';
	} else if (code === 408) {
		message = 'Request Time-out';
	} else if (code === 411) {
		message = 'Length Required';
	} else if (code === 412) {
		message = 'Precondition Failed';
	} else if (code === 416) {
		message = 'Requested range not satisfiable';
	} else if (code === 500) {
		message = 'Internal Server Error';
	} else if (code === 503) {
		message = 'Server Unavailable';
	}
	response.statusCode = code;
	response.statusMessage = message;
	response.setHeader('Content-Type', 'text/html');
	response.end(`<html><head><meta charset="utf-8"><title>${code} ${message}</title></head><body><h1>${code} ${message}</h1><img src="https://http.cat/${code}" alt="${code} ${message}" title="${code} ${message}"></body></html>\n`);
};

var http_return_file = function (response, filepath) {
	process.stdout.write(`http_return_file(response, "${filepath}")...`);
	fs.readFile(filepath, 'binary', function (error, file) {
		if (error) {
			http_return_error(response, 404);
		} else {
			response.statusCode = 200;
			response.statusMessage = 'OK';
			let mime = MIME_TYPE_MAP.extensions ? MIME_TYPE_MAP.extensions[path.extname(filepath)] : null;
			if (mime) {
				response.setHeader('Content-Type', mime[0]);
			}
			response.write(file, 'binary');
			response.end();
		}
	});
	process.stdout.write(' DONE.\n');
};

var http_return_json = function (response, json) {
	response.statusCode = 200;
	response.statusMessage = 'OK';
	response.setHeader('Content-Type', 'application/json');
	response.end(JSON.stringify(json) + '\n');
};

var get_pic_path = function (pic_id, files_list) {
	if (!files_list) {
		files_list = list_files(PICS_PATH);
	}
	for (let i = 0; i < files_list.length; ++i) {
		let filepath = files_list[i],
			filename = path.basename(filepath, path.extname(filepath)),
			file_id = filename.match(/^[a-f0-9]{32}/g);
		if (file_id && file_id[0] === pic_id) {
			return filepath;
		}
	}
	return null;
};

var list_files = function (tmpPath) {
	let files_list = [];
	if (!path.isAbsolute(tmpPath)) {
		tmpPath = path.resolve(tmpPath);
	}
	try {
		fs.accessSync(tmpPath, fs.constants.F_OK);
		let stats = fs.statSync(tmpPath);
		if (stats.isDirectory()) {
			let array = fs.readdirSync(tmpPath);
			array.forEach(function (filename) {
				if (filename.charAt(0) === '.') {
					return;
				}
				try {
					let f = path.normalize(tmpPath + path.sep + filename),
						stats = fs.statSync(f);
					if (stats.isFile()) {
						fs.accessSync(f, fs.constants.R_OK | fs.constants.W_OK);
						files_list.push(f);
					} else if (stats.isDirectory()) {
						files_list = files_list.concat(list_files(f));
					}
				} catch (e) {}
			});
		} else if (stats.isFile()) {
			try {
				fs.accessSync(tmpPath, fs.constants.R_OK | fs.constants.W_OK);
				files_list.push(tmpPath);
			} catch (e) {}
		}
	} catch (e) {}
	return files_list;
};

var random_files = function (files_list, quantity) {
	if (!quantity) {
		quantity = 50;
	}
	if (quantity > files_list.length) {
		quantity = files_list.length;
	}
	let random_files_list = [];
	for (let i = 0; i < quantity; ++i) {
		let filepath = files_list[Math.floor(Math.random() * files_list.length)];
		if (random_files_list.indexOf(filepath) !== -1) {
			i--;
		} else {
			random_files_list.push(filepath);
		}
	}
	return random_files_list;
};

var tags_sorting = function (a, b) {
	if (/^[a-f0-9]{32}$/g.test(a)) {
		return -1;
	} else if (/^[a-f0-9]{32}$/g.test(b)) {
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

var remix_files = function (files_list) {
	console.log('remix_files...');
	let timestamp = Date.now(),
		perc = 0,
		perc_step = 100 / files_list.length;
	process.stdout.write('\t[');
	files_list.forEach(function (filepath, index) {
		let ext = path.extname(filepath).substring(1).toLowerCase(),
			basename = path.basename(filepath),
			mixed_path = PICS_PATH + path.sep + ext + path.sep + basename;
		if (filepath !== mixed_path) {
			try {
				fs.accessSync(path.normalize(PICS_PATH + path.sep + ext), fs.constants.F_OK);
			} catch (e) {
				fs.mkdirSync(path.normalize(PICS_PATH + path.sep + ext), { recursive: true });
			}
			fs.renameSync(path.normalize(filepath), path.normalize(mixed_path));
		}
		if ((index + 1) * 100 / files_list.length > perc) {
			process.stdout.write('#');
			perc += perc_step;
		}
	});
	process.stdout.write('] (' + ((Date.now() - timestamp) / 1000) + ' seconds)\n');
	console.log('DONE.');
};

var rehash_files = function (files_list) {
	console.log('rehash_files...');
	console.log('\tSearching duplicates...');
	let timestamp = Date.now(),
		perc = 0,
		perc_step = 100 / files_list.length;
	process.stdout.write('\t[');
	let hashMap = Object.create(null);
	let count = 0;
	files_list.forEach(function (filepath, index) {
		let digest = crypto.createHash('md5').update(fs.readFileSync(filepath)).digest('hex'); // .substring(0, 6);
		if (hashMap[digest]) {
			hashMap[digest].push(filepath);
			count++;
		} else {
			hashMap[digest] = [filepath];
		}
		if ((index + 1) * 100 / files_list.length > perc) {
			process.stdout.write('#');
			perc += perc_step;
		}
	});
	process.stdout.write('] (' + ((Date.now() - timestamp) / 1000) + ' seconds)\n');
	console.log(`\t${count} duplicated files has been found.`);
	console.log('\tRehashing files...');
	timestamp = Date.now();
	let rehashCount = 0,
		duplicateCount = 0,
		issues = [],
		hash_array = Object.keys(hashMap);
	perc = 0;
	perc_step = 100 / hash_array.length;
	process.stdout.write('\t[');
	hash_array.forEach(function (digest, index) {
		let tags = [];
		hashMap[digest].forEach(function (filepath) {
			let file_tags = path.basename(filepath, path.extname(filepath)).split(' ');
			file_tags.forEach(function (tag) {
				tag = tag.trim();
				// /^[a-zA-Z0-9àèéìòùç\'\"\-\_]+$/g.test(tag)
				if (!(/^[a-f0-9]{32}$/g.test(tag)) && tag !== '' && !(/(^[0-9no\-\_]+$|^IMG|^DSC|^Screenshot|^Schermata)/g.test(tag)) && tags.indexOf(tag) === -1) {
					tags.push(tag);
				}
			});
		});
		tags = tags.length > 0 ? ' ' + tags.sort(tags_sorting).join(' ') : '';
		hashMap[digest].forEach(function (filepath, index) {
			if (index === 0) {
				let new_filename = digest + tags;
				if (new_filename.length + path.extname(filepath).length > 255) {
					issues.push('\tName "' + new_filename + '" too long, reduced to "' + digest + '"');
					new_filename = digest;
				}
				if (new_filename !== path.basename(filepath, path.extname(filepath))) {
					fs.renameSync(path.normalize(filepath), path.normalize(path.dirname(filepath) + path.sep + new_filename + path.extname(filepath).toLowerCase()));
				}
				rehashCount++;
			} else {
				try {
					fs.unlinkSync(filepath);
					issues.push('\tRemoved duplicate file ' + path.basename(filepath));
					duplicateCount++;
				} catch (e) {
					issues.push('\tError: An error occurred removing duplicate file ' + filepath);
				}
			}
		});
		if ((index + 1) * 100 / hash_array.length > perc) {
			process.stdout.write('#');
			perc += perc_step;
		}
	});
	process.stdout.write('] (' + ((Date.now() - timestamp) / 1000) + ' seconds)\n');
	issues.forEach(function (issue) {
		console.log(issue);
	});
	console.log('\t' + rehashCount + ' files has been rehashed.');
	console.log('\t' + duplicateCount + ' duplicated files has been removed.');
	console.log('DONE.');
};

var list_tags = function (files_list) {
	process.stdout.write('list_tags...');
	let labels = [],
		count = [];
	files_list.forEach(function (filepath, index) {
		let picTags = path.basename(filepath, path.extname(filepath)).split(' '),
			ext = path.extname(filepath).toLowerCase().replace('.', '');
		picTags.splice(0, 1);
		picTags.push(ext);
		picTags.forEach(function (tag) {
			let index = labels.indexOf(tag);
			if (index === -1) {
				labels.push(tag);
				count.push(1);
			} else {
				count[index]++;
			}
		});
	});
	let tags = [];
	labels.forEach(function (tag, index) {
		tags.push({
			label: tag,
			count: count[index]
		});
	});
	tags.sort(function (a, b) {
		return a.label < b.label ? -1 : 1;
	});
	process.stdout.write(' DONE.\n');
	return tags;
};

var list_pics = function (files_list, tags) {
	process.stdout.write('list_pics...');
	let pics = [];
	files_list.forEach(function (filepath, index) {
		let picTags = path.basename(filepath, path.extname(filepath)).split(' '),
			ext = path.extname(filepath).toLowerCase().replace('.', ''),
			hash = picTags[0];
		picTags.splice(0, 1);
		picTags.push(ext);
		let match = true;
		if (tags) {
			tags.forEach(function (tag) {
				match = match && picTags.includes(tag);
			});
		}
		if (match) {
			let stats = fs.statSync(filepath);
			pics.push({
				id: hash,
				//path: filepath.replace(PICS_PATH, ''), //path.basename(filepath),
				ext: path.extname(filepath).toLowerCase().replace('.', ''),
				tags: picTags,
				ts: stats.birthtime.getTime()
			});
		}
	});
	pics.sort(function (a, b) {
		return a.ts > b.ts ? -1 : 1;
	});
	process.stdout.write(' DONE.\n');
	return pics;
};

var edit_pics = function (files_list, tags) {
	console.log('edit_pics...');
	console.log('\tEditing tags', tags);
	tags.sort(tags_sorting);
	let tags_string = tags.join(' ');
	files_list.forEach(function (filepath) {
		let old_filename = path.basename(filepath, path.extname(filepath)),
			pic_id = old_filename.match(/^[a-f0-9]{32}/g),
			new_filename = (pic_id ? pic_id[0] + ' ' : '') + tags_string;
		if (old_filename !== new_filename) {
			console.log('\t\tRenaming ', old_filename, '-->', new_filename);
			try {
				fs.renameSync(path.normalize(filepath), path.normalize(path.dirname(filepath) + path.sep + new_filename + path.extname(filepath)));
			} catch (e) {
				console.error('\t\t\tError renaming file', e);
			}
		}
	});
	console.log('DONE.');
};

var remove_pics = function (files_list) {
	console.log('remove_pics...');
	files_list.forEach(function (filepath) {
		let filename = path.basename(filepath, path.extname(filepath));
		console.log('\tRemoving ', filename);
		try {
			fs.unlinkSync(filepath);
		} catch (e) {
			console.error('\t\tError unlinking file', e);
		}
	});
	console.log('DONE.');
};
