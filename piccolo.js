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
fs.readFile(path.resolve(__dirname, 'ui/mime-map.json'), 'UTF-8', function (error, file) {
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

	let tokens = parsed_url.pathname.split('/');

	if (parsed_url.pathname === '' || parsed_url.pathname === '/') {

		// REQUEST: /
		// return index file

		let filepath = path.resolve(__dirname, 'ui/index.html');
		http_return_file(request, response, filepath);

	} else if (tokens[1] === 'tags') {

		const tag_id = tokens[2];
		if (!tag_id) {

			// REQUEST: /tags
			// list tags

			let files_list = list_files(PICS_PATH);
			http_return_json(response, { status: 'ok', tags: tags_list(files_list) });

		} else {

			const action = tokens[3];
			if (!action) {

				// REQUEST: /tags/<id>
				// list pics containing this tag

				let files_list = list_files(PICS_PATH);
				http_return_json(response, { status: 'ok', pics: pics_list(files_list, [tag_id]) });

			} if (action === 'remove') {

				// REQUEST: /tags/<id>/remove
				// remove tag, removing it from any pic

				let files_list = list_files(PICS_PATH);
				files_list.forEach(function (filepath) {
					let pic_tags = file_get_tags(filepath),
						index = pic_tags.indexOf(tag_id);
					if (index !== -1) {
						pic_tags.splice(index, 1);
						file_retag(filepath, pic_tags);
					}
				});
				http_return_json(response, { status: 'ok' });

			} else if (action === 'edit') {

				// REQUEST: /tags/<id>/edit?new=<new_tag>
				// edit (rename) tag, replacing it from any pic

				const new_tag = parsed_url.searchParams.get('new');
				let files_list = list_files(PICS_PATH);
				files_list.forEach(function (filepath) {
					let pic_tags = file_get_tags(filepath),
						index = pic_tags.indexOf(tag_id);
					if (index !== -1) {
						pic_tags[index] = new_tag;
						file_retag(filepath, pic_tags);
					}
				});
				http_return_json(response, { status: 'ok' });

			}
		}

	} else if (tokens[1] === 'pics') {

		const pic_id = tokens[2];
		if (!pic_id) {

			// REQUEST: /pics
			// list all pics

			let files_list = list_files(PICS_PATH);
			http_return_json(response, { status: 'ok', pics: pics_list(files_list) });

		} else if (pic_id === 'random') {

			// REQUEST: /pics/random
			// list random pics

			let files_list = list_files(PICS_PATH),
				quantity = 50,
				random_files_list = [];
			if (quantity > files_list.length) {
				quantity = files_list.length;
			}
			for (let i = 0; i < quantity; ++i) {
				let filepath = files_list[Math.floor(Math.random() * files_list.length)];
				if (random_files_list.indexOf(filepath) !== -1) {
					i--;
				} else {
					random_files_list.push(filepath);
				}
			}
			http_return_json(response, { status: 'ok', pics: pics_list(random_files_list) });

		} else if (pic_id === 'untagged') {

			// REQUEST: /pics/untagged
			// list untagged pics

			let files_list = list_files(PICS_PATH);
			let untagged_files_list = [];
			files_list.forEach(function (filepath) {
				if (file_get_tags(filepath).length === 0) {
					untagged_files_list.push(filepath);
				}
			});
			http_return_json(response, { status: 'ok', pics: pics_list(untagged_files_list) });

		} else if (pic_id === 'rehash') {

			// REQUEST: /pics/rehash
			// rehash and remix all pics

			let files_list = list_files(PICS_PATH);
			files_rehash(files_list);
			files_list = list_files(PICS_PATH);
			files_remix(files_list);
			http_return_json(response, { status: 'ok' });

		} else if (pic_id === 'upload') {

			// REQUEST: /pics/upload
			// upload a pic

			let body = [];
			request.on('data', (chunk) => {
				body.push(chunk);
				/*
				// upload limit
				if (body.length > ???) {
					request.connection.destroy();
				}
				*/
			}).on('end', () => {
				body = Buffer.concat(body).toString();
				console.log(body);
				// at this point, `body` has the entire request body stored in it as a string
				http_return_json(response, { status: 'ok' });
			});

		} else {

			const action = tokens[3];
			if (!action) {

				// REQUEST: /pics/<id>
				// serve pic file

				let filepath = pic_get_filepath(decodeURIComponent(pic_id));
				if (!filepath) {
					http_return_error(response, 404);
				} else {
					http_return_file(request, response, filepath);
				}

			} else if (action === 'remove') {

				// REQUEST: /pics/<id>/remove
				// remove pic

				let filepath = pic_get_filepath(pic_id);
				file_remove(filepath);
				http_return_json(response, { status: 'ok' });

			} else if (action === 'edit') {

				// REQUEST: /pics/<id>/edit?tags=<tags>
				// edit pic

				const request_tags = parsed_url.searchParams.get('tags');
				let filepath = pic_get_filepath(pic_id);
				let tags = request_tags ? JSON.parse(request_tags) : [];
				file_retag(filepath, tags);
				http_return_json(response, { status: 'ok' });

			}
		}

	} else {

		// REQUEST: fs server
		// serve file

		let filepath = path.resolve(__dirname, `ui/${parsed_url.pathname.substring(1)}`);
		http_return_file(request, response, filepath);

	}

	console.log('\n---\n');
});

server.listen(PORT, HOSTNAME, () => {
	console.log(`Server running at ${PROTOCOL}${HOSTNAME}:${PORT}/\nCTRL + C to shutdown\n\n===\n`);
});

/*
##     ## ######## ######## ########
##     ##    ##       ##    ##     ##
##     ##    ##       ##    ##     ##
#########    ##       ##    ########
##     ##    ##       ##    ##
##     ##    ##       ##    ##
##     ##    ##       ##    ##
*/

var http_return_error = function (response, code) {
	console.log(`http_return_error: ${code}`);
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
	response.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${code} ${message}</title></head><body><h1>${code} ${message}</h1><img src="https://http.cat/${code}" alt="${code} ${message}" title="${code} ${message}"></body></html>\n`);
};

var http_return_file = function (request, response, filepath) {
	console.log(`http_return_file: ${filepath}`);
	const stat = fs.statSync(filepath);
	const filesize = stat.size;
	const range = request.headers.range;
	if (range) {
		const parts = range.replace(/bytes=/, '').split('-');
		const start = parseInt(parts[0], 10);
		const end = parts[1] ? parseInt(parts[1], 10) : filesize - 1;
		const chunksize = (end - start) + 1;
		response.statusCode = 206;
		response.statusMessage = 'Partial Content';
		let mime = MIME_TYPE_MAP.extensions ? MIME_TYPE_MAP.extensions[path.extname(filepath)] : null;
		if (mime) {
			response.setHeader('Content-Type', mime[0]);
		}
		response.setHeader('Content-Range', `bytes ${start}-${end}/${filesize}`);
		response.setHeader('Accept-Ranges', 'bytes');
		response.setHeader('Content-Length', chunksize);
		const stream = fs.createReadStream(filepath, { start: start, end: end });
		stream.pipe(response);
		stream.on('end', function () {
			response.end();
		});
	} else {
		response.statusCode = 200;
		response.statusMessage = 'OK';
		let mime = MIME_TYPE_MAP.extensions ? MIME_TYPE_MAP.extensions[path.extname(filepath)] : null;
		if (mime) {
			response.setHeader('Content-Type', mime[0]);
		}
		response.setHeader('Content-Length', filesize);
		const stream = fs.createReadStream(filepath);
		stream.pipe(response);
		stream.on('end', function () {
			response.end();
		});
	}
};

var http_return_json = function (response, json) {
	response.statusCode = 200;
	response.statusMessage = 'OK';
	response.setHeader('Content-Type', 'application/json');
	response.end(JSON.stringify(json) + '\n');
};

/*
######## #### ##       ########  ######
##        ##  ##       ##       ##    ##
##        ##  ##       ##       ##
######    ##  ##       ######    ######
##        ##  ##       ##             ##
##        ##  ##       ##       ##    ##
##       #### ######## ########  ######
*/

var file_get_id = function (filepath) {
	let filename = path.basename(filepath, path.extname(filepath)),
		pic_id = filename.match(/^[a-f0-9]{32}/g) ? filename.match(/^[a-f0-9]{32}/g)[0] : null;
	return pic_id;
};

var file_get_tags = function (filepath) {
	let filename = path.basename(filepath, path.extname(filepath)),
		pic_id = file_get_id(filepath),
		pic_tags = filename.split(' ');
	if (pic_tags.indexOf(pic_id) !== -1) {
		pic_tags.splice(pic_tags.indexOf(pic_id), 1);
	}
	return pic_tags;
};

var file_retag = function (filepath, tags) {
	let filename = path.basename(filepath, path.extname(filepath)),
		pic_id = file_get_id(filepath),
		tags_string = tags.sort(tags_sorting).join(' '),
		ext = path.extname(filepath),
		new_filename = `${pic_id || ''}${tags_string.length > 0 ? ` ${tags_string}` : ''}`;
	if (filename !== new_filename) {
		console.log('file_retag: Renaming', filename, '-->', new_filename);
		try {
			fs.renameSync(path.normalize(filepath), path.normalize(`${path.dirname(filepath)}${path.sep}${new_filename}${ext}`));
		} catch (e) {
			console.error('file_retag: Error renaming file', e);
		}
	}
};

var file_remove = function (filepath) {
	let filename = path.basename(filepath, path.extname(filepath));
	console.log('file_remove: Removing', filename);
	try {
		fs.unlinkSync(filepath);
	} catch (e) {
		console.error('file_remove: Error unlinking file', e);
	}
};

var list_files = function (tmp_path) {
	let files_list = [];
	if (!path.isAbsolute(tmp_path)) {
		tmp_path = path.resolve(tmp_path);
	}
	try {
		let stats = fs.statSync(tmp_path);
		if (stats.isDirectory()) {
			let array = fs.readdirSync(tmp_path);
			array.forEach(function (filename) {
				if (filename.charAt(0) === '.') {
					return;
				}
				try {
					let f = path.normalize(tmp_path + path.sep + filename),
						stats = fs.statSync(f);
					if (stats.isFile()) {
						files_list.push(f);
					} else if (stats.isDirectory()) {
						files_list = files_list.concat(list_files(f));
					}
				} catch (e) {}
			});
		} else if (stats.isFile()) {
			files_list.push(tmp_path);
		}
	} catch (e) {}
	return files_list;
};

var files_rehash = function (files_list) {
	console.log('files_rehash...');
	console.log('\tSearching duplicates...');
	let timestamp = Date.now();
	process.stdout.write('\tProcessing...');
	let hash_map = Object.create(null);
	let count = 0;
	files_list.forEach(function (filepath, index) {
		let digest = crypto.createHash('md5').update(fs.readFileSync(filepath)).digest('hex');
		if (hash_map[digest]) {
			hash_map[digest].push(filepath);
			count++;
		} else {
			hash_map[digest] = [filepath];
		}
		process.stdout.clearLine();
		process.stdout.cursorTo(0);
		process.stdout.write(`\t${index + 1}/${files_list.length} (${Math.floor((index + 1) * 100 / files_list.length)}%)`);
	});
	console.log(`\n\t${count} duplicated files has been found in ${(Date.now() - timestamp) / 1000} seconds.`);
	console.log('\tRehashing files...');
	timestamp = Date.now();
	let count_rehashed = 0,
		count_duplicate_removed = 0,
		issues = [],
		hash_array = Object.keys(hash_map);
	process.stdout.write('\tProcessing...');
	hash_array.forEach(function (digest, index) {
		let tags = [];
		hash_map[digest].forEach(function (filepath) {
			let file_tags = file_get_tags(filepath);
			file_tags.forEach(function (tag) {
				tag = tag.trim();
				if (tag !== '' && !(/(^[0-9no\-_]+$|^IMG|^DSC|^Screenshot|^Schermata)/g.test(tag)) && tags.indexOf(tag) === -1) {
					tags.push(tag);
				}
			});
		});
		tags = tags.length > 0 ? ` ${tags.sort(tags_sorting).join(' ')}` : '';
		hash_map[digest].forEach(function (filepath, index) {
			if (index === 0) {
				let new_filename = digest + tags;
				if (new_filename.length + path.extname(filepath).length > 255) {
					new_filename = digest;
					issues.push(`\tName "${new_filename}" too long, reduced to "${digest}"`);
				}
				if (new_filename !== path.basename(filepath, path.extname(filepath))) {
					fs.renameSync(path.normalize(filepath), path.normalize(`${path.dirname(filepath)}${path.sep}${new_filename}${path.extname(filepath).toLowerCase()}`));
					count_rehashed++;
				}
			} else {
				try {
					fs.unlinkSync(filepath);
					count_duplicate_removed++;
					issues.push(`\tRemoved duplicate file ${path.basename(filepath)}`);
				} catch (e) {
					issues.push(`\tError: An error occurred removing duplicate file ${filepath}`);
				}
			}
		});
		process.stdout.clearLine();
		process.stdout.cursorTo(0);
		process.stdout.write(`\t${index + 1}/${hash_array.length} (${Math.floor((index + 1) * 100 / hash_array.length)}%)`);
	});
	console.log(`\n\tRehashing completed in ${(Date.now() - timestamp) / 1000} seconds.`);
	issues.forEach(function (issue) {
		console.log(issue);
	});
	console.log(`\t${count_rehashed} files has been rehashed.`);
	console.log(`\t${count_duplicate_removed} duplicated files has been removed.`);
	console.log('DONE.');
};

var files_remix = function (files_list) {
	console.log('files_remix...');
	let timestamp = Date.now();
	process.stdout.write('\tProcessing...');
	files_list.forEach(function (filepath, index) {
		let ext = path.extname(filepath).substring(1).toLowerCase(),
			basename = path.basename(filepath),
			mixed_path = `${PICS_PATH}${path.sep}${ext}${path.sep}${basename}`;
		if (filepath !== mixed_path) {
			try {
				fs.accessSync(path.normalize(`${PICS_PATH}${path.sep}${ext}`), fs.constants.F_OK);
			} catch (e) {
				fs.mkdirSync(path.normalize(`${PICS_PATH}${path.sep}${ext}`), { recursive: true });
			}
			fs.renameSync(path.normalize(filepath), path.normalize(mixed_path));
		}
		process.stdout.clearLine();
		process.stdout.cursorTo(0);
		process.stdout.write(`\t${index + 1}/${files_list.length} (${Math.floor((index + 1) * 100 / files_list.length)}%)`);
	});
	console.log(`\tRemixing completed in ${(Date.now() - timestamp) / 1000} seconds.`);
	console.log('DONE.');
};

/*
########    ###     ######    ######
   ##      ## ##   ##    ##  ##    ##
   ##     ##   ##  ##        ##
   ##    ##     ## ##   ####  ######
   ##    ######### ##    ##        ##
   ##    ##     ## ##    ##  ##    ##
   ##    ##     ##  ######    ######
*/

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

var tags_list = function (files_list) {
	let map = {};
	files_list.forEach(function (filepath) {
		file_get_tags(filepath).forEach(function (tag) {
			if (map[tag]) {
				map[tag].count++;
			} else {
				map[tag] = {
					count: 1,
					cover: file_get_id(filepath)
				};
			}
		});
	});
	let tags = [];
	Object.keys(map).forEach(function (tag) {
		tags.push({
			label: tag,
			count: map[tag].count,
			cover: map[tag].cover
		});
	});
	tags.sort(function (a, b) {
		return tags_sorting(a.label, b.label);
	});
	return tags;
};

/*
########  ####  ######   ######
##     ##  ##  ##    ## ##    ##
##     ##  ##  ##       ##
########   ##  ##        ######
##         ##  ##             ##
##         ##  ##    ## ##    ##
##        ####  ######   ######
*/

var pic_get_filepath = function (pic_id, files_list) {
	if (!files_list) {
		files_list = list_files(PICS_PATH);
	}
	for (let i = 0; i < files_list.length; ++i) {
		let filepath = files_list[i],
			file_id = file_get_id(filepath);
		if (file_id === pic_id) {
			return filepath;
		}
	}
	return null;
};

var pics_list = function (files_list, filter_tags) {
	let pics = [];
	files_list.forEach(function (filepath) {
		let pic_tags = file_get_tags(filepath),
			match = true;
		if (filter_tags) {
			filter_tags.forEach(function (tag) {
				match = match && pic_tags.includes(tag);
			});
		}
		if (match) {
			let stats = fs.statSync(filepath);
			pics.push({
				id: file_get_id(filepath),
				ext: path.extname(filepath).toLowerCase().replace('.', ''),
				tags: pic_tags,
				ts: stats.birthtime.getTime()
			});
		}
	});
	pics.sort(function (a, b) {
		return a.ts > b.ts ? -1 : 1;
	});
	return pics;
};
