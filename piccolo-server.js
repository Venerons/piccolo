const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const hostname = '127.0.0.1';
const port = process.argv[3] ? parseInt(process.argv[3], 10) : 3000;
const pics_path = process.argv[2]

// node piccolo-server.js <pics_path> <port>
// Examples:
// node piccolo-server.js "/home/Admin/Images"
// node piccolo-server.js "/home/Admin/Images" 8080

const server = http.createServer((request, response) => {
	//console.log('request.httpVersion', request.httpVersion);
	//console.log('request.method', request.method);
	//console.log('request.url', request.url);
	//console.log('request.headers', request.headers);
	console.log(request.url, '\n');

	const parsed_url = new URL(`http://${hostname}:${port}${request.url}`);

	if (parsed_url.pathname === '/') {
		// INDEX
		console.log(request.method, path.resolve(__dirname, 'index.html'));
		fs.readFile(path.resolve(__dirname, 'index.html'), 'UTF-8', function (error, file) {
			if (error) {
				returnHTTPError(response, 500, error);
			} else {
				response.statusCode = 200;
				response.statusMessage = 'OK';
				response.setHeader('Content-Type', 'text/html');
				response.end(file);
			}
		});
	} else if (parsed_url.pathname === '/api') {
		// API
		response.statusCode = 200;
		response.statusMessage = 'OK';
		response.setHeader('Content-Type', 'application/json');
		const action = parsed_url.searchParams.get('action');
		if (!action) {
			response.end('{"status":"error","error":"INVALID_REQUEST"}\n');
		} else if (action === 'rehash') {
			// REHASH - ?action=rehash
			var filesList = getFilesList(pics_path);
			rehash(filesList);
			filesList = getFilesList(pics_path);
			remix(filesList);
			response.end('{"status":"ok"}\n');
		} else if (action === 'list_tags') {
			// LIST TAGS - ?action=list_tags
			var filesList = getFilesList(pics_path),
				json = getTagsList(filesList);
			response.end(JSON.stringify({ status: 'ok', tags: json }) + '\n');
		} else if (action === 'list_pics') {
			// LIST PICS - ?action=list_pics&tags=tag1,tag2
			const request_tags = parsed_url.searchParams.get('tags');
			var filesList = getFilesList(pics_path),
				tags = [];
			if (request_tags) {
				tags = request_tags.split(',');
			}
			var json = getPicsList(filesList, tags);
			response.end(JSON.stringify({ status: 'ok', pics: json }) + '\n');
		} else if (action === 'tags') {
			// ADD TAGS - ?action=tags&pics=<pics>&add=<tags>
			// REMOVE TAGS - ?action=tags&pics=<pics>&remove=<tags>
			const request_pics = parsed_url.searchParams.get('pics');
			const request_add = parsed_url.searchParams.get('add');
			const request_remove = parsed_url.searchParams.get('remove');
			if (!request_pics || !request_add || !request_remove) {
				response.end('{"status":"error","error":"INVALID_REQUEST"}\n');
			} else {
				var filesList = [];
				JSON.parse(request_pics).forEach(function (item) {
					filesList.push(pics_path + path.sep + item);
				});
				var add = JSON.parse(request_add),
					remove = JSON.parse(request_remove);
				if (add.length > 0) {
					addTags(filesList, add);
				}
				if (remove.length > 0) {
					removeTags(filesList, remove);
				}
				response.end(JSON.stringify({ status: 'ok' }) + '\n');
			}
		} else if (action === 'random_pics') {
			// RANDOM PICS - ?action=random_pics
			var filesList = getFilesList(pics_path),
				pics = [],
				pickedPics = [];
			const tot_pics = filesList.length;
			for (let i = 0; i < 50 && i < tot_pics; ++i) {
				var filepath = filesList[Math.floor(Math.random() * tot_pics)];
				if (pickedPics.indexOf(filepath) !== -1) {
					i--;
				} else {
					pickedPics.push(filepath);
				}
			}
			response.end(JSON.stringify({ status: 'ok', pics: getPicsList(pickedPics, []) }) + '\n');
		} else {
			response.end('{"status":"error","error":"INVALID_REQUEST"}\n');
		}
	} else if (parsed_url.pathname === '/pic') {
		// PIC
		const request_path = parsed_url.searchParams.get('path');
		if (!request_path) {
			returnHTTPError(response, 404, 'Not Found');
		} else {
			var ext = path.extname(request_path),
				mime = mimeTypeMap.extensions[ext];
			console.log('/pic', pics_path + path.sep + request_path);
			fs.readFile(pics_path + path.sep + request_path, 'binary', function (error, file) {
				if (error) {
					returnHTTPError(response, 404, 'Not Found');
				} else {
					response.statusCode = 200;
					response.statusMessage = 'OK';
					if (mime) {
						response.setHeader('Content-Type', mime[0]);
					}
					response.write(file, 'binary');
					response.end();
				}
			});
		}
	} else {
		// FS SERVER
		console.log(request.method, path.resolve(__dirname, parsed_url.pathname.substring(1)));
		var filename = path.resolve(__dirname, parsed_url.pathname.substring(1)),
			ext = path.extname(filename),
			mime = mimeTypeMap.extensions[ext];
		fs.readFile(filename, 'binary', function (error, file) {
			if (error) {
				returnHTTPError(response, 404, 'Not Found');
			} else {
				response.statusCode = 200;
				response.statusMessage = 'OK';
				if (mime) {
					response.setHeader('Content-Type', mime[0]);
				}
				response.write(file, 'binary');
				response.end();
			}
		});
	}

	console.log('---');
});

server.listen(port, hostname, () => {
	console.log(`Server running at http://${hostname}:${port}/\nCTRL + C to shutdown\n===`);
});

// MIME TYPE MAP

var mimeTypeMap = {};
fs.readFile(path.resolve(__dirname, 'mime-map.json'), 'UTF-8', function (error, file) {
	if (error) {
		console.log('Warning: mime-map.json loading failed');
	} else {
		mimeTypeMap = JSON.parse(file);
	}
});

// RETURN HTTP ERROR

var returnHTTPError = function (response, code, message) {
	response.statusCode = code;
	response.statusMessage = message;
	response.setHeader('Content-Type', 'text/html');
	response.end(`<html><head><meta charset="utf-8"><title>${code} ${message}</title></head><body><h1>Error ${code}</h1><h2>${message}</h2></body></html>\n`);
};

// GET FILES LIST

var getFilesList = function (tmpPath) {
	var filesList = [];
	if (!path.isAbsolute(tmpPath)) {
		tmpPath = path.resolve(tmpPath);
	}
	try {
		fs.accessSync(tmpPath, fs.constants.F_OK);
		var stats = fs.statSync(tmpPath);
		if (stats.isDirectory()) {
			var array = fs.readdirSync(tmpPath);
			array.forEach(function (filename) {
				if (filename.charAt(0) === '.') {
					return;
				}
				try {
					var stats = fs.statSync(tmpPath + path.sep + filename);
					if (stats.isFile()) {
						fs.accessSync(tmpPath + path.sep + filename, fs.constants.R_OK | fs.constants.W_OK);
						filesList.push(tmpPath + path.sep + filename);
					} else if (stats.isDirectory()) {
						filesList = filesList.concat(getFilesList(tmpPath + path.sep + filename));
					}
				} catch (e) {}
			});
		} else if (stats.isFile()) {
			try {
				fs.accessSync(tmpPath, fs.constants.R_OK | fs.constants.W_OK);
				filesList.push(tmpPath);
			} catch (e) {}
		}
	} catch (e) {}
	return filesList;
};

// TAGS SORTING

var tagsSorting = function (a, b) {
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

// REMIX

var remix = function (filesList) {
	console.log('Remixing...');
	var timestamp = Date.now();
	filesList.forEach(function (filepath) {
		var ext = path.extname(filepath).substring(1).toLowerCase(),
			basename = path.basename(filepath),
			mixed_path = pics_path + path.sep + ext + path.sep + basename;
		if (filepath !== mixed_path) {
			try {
				fs.accessSync(pics_path + path.sep + ext, fs.constants.F_OK);
			} catch (e) {
				fs.mkdirSync(pics_path + path.sep + ext, { recursive: true });
			}
			fs.renameSync(filepath, mixed_path);
		}
	});
	console.log('\tRemixing completed in ' + ((Date.now() - timestamp) / 1000) + ' seconds.');
	console.log('Remixing DONE');
};

// REHASH

var rehash = function (filesList) {
	console.log('Rehashing...');
	console.log('\tSearching duplicates...');
	var timestamp = Date.now();
	var hashMap = Object.create(null);
	filesList.forEach(function (filepath) {
		var digest = crypto.createHash('md5').update(fs.readFileSync(filepath)).digest('hex'); // .substring(0, 6);
		if (hashMap[digest]) {
			hashMap[digest].push(filepath);
		} else {
			hashMap[digest] = [filepath];
		}
	});
	console.log('\tDuplicates search completed in ' + ((Date.now() - timestamp) / 1000) + ' seconds.');
	console.log('\tRehashing files...');
	timestamp = Date.now();
	var rehashCount = 0,
		duplicateCount = 0;
	Object.keys(hashMap).forEach(function (digest) {
		var array = [];
		hashMap[digest].forEach(function (filepath) {
			var fileTags = path.basename(filepath, path.extname(filepath)).split(' ');
			fileTags.forEach(function (tag) {
				// /^[a-zA-Z0-9àèéìòùç\'\"\-\_]+$/g.test(tag)
				tag = tag.trim();
				if (tag !== '' && !(/(^[0-9no\-\_]+$|^IMG|^DSC|^Screenshot|^Schermata)/g.test(tag)) && !(/^[a-f0-9]{32}$/g.test(tag)) && array.indexOf(tag) === -1) {
					array.push(tag);
				}
			});
		});
		array.sort(tagsSorting);
		hashMap[digest].forEach(function (filepath, index) {
			if (index === 0) {
				var newFileName = digest + (array.length !== 0 ? ' ' + array.join(' ') : '');
				if (newFileName.length + path.extname(filepath).length > 255) {
					console.log('\tName "' + newFileName + '" too long, reduced to "' + digest + '"');
					newFileName = digest;
				}
				if (newFileName !== path.basename(filepath, path.extname(filepath))) {
					fs.renameSync(filepath, path.dirname(filepath) + path.sep + newFileName + path.extname(filepath).toLowerCase());
				}
				rehashCount++;
			} else {
				try {
					fs.unlinkSync(filepath);
					console.log('\tRemoved duplicate file ' + path.basename(filepath));
					duplicateCount++;
				} catch (e) {
					console.error('\tError: An error occurred removing duplicate file ' + filepath);
				}
			}
		});
	});
	console.log('\t' + rehashCount + ' files has been rehashed.');
	console.log('\t' + duplicateCount + ' duplicated files has been removed.');
	console.log('\tRehashing completed in ' + ((Date.now() - timestamp) / 1000) + ' seconds.');
	console.log('Rehashing DONE');
};

// GET TAGS LIST

var getTagsList = function (filesList) {
	console.log('getTagsList...');
	var labels = [],
		count = [];
	filesList.forEach(function (filepath, index) {
		var picTags = path.basename(filepath, path.extname(filepath)).split(' ');
		picTags.splice(0, 1);
		picTags.forEach(function (tag) {
			var index = labels.indexOf(tag);
			if (index === -1) {
				labels.push(tag);
				count.push(1);
			} else {
				count[index]++;
			}
		});
	});
	var tags = [];
	labels.forEach(function (tag, index) {
		tags.push({
			label: tag,
			count: count[index]
		});
	})
	tags.sort(function (a, b) {
		return a.label < b.label ? -1 : 1;
	});
	console.log('getTagsList DONE');
	return tags;
};

// GET PICS LIST

var getPicsList = function (filesList, tags) {
	console.log('getPicsList...');
	var pics = [];
	filesList.forEach(function (filepath, index) {
		var picTags = path.basename(filepath, path.extname(filepath)).split(' '),
			hash = picTags[0];
		picTags.splice(0, 1);
		var match = true;
		tags.forEach(function (tag) {
			match = match && picTags.includes(tag);
		});
		if (match) {
			var stats = fs.statSync(filepath);
			pics.push({
				path: filepath.replace(pics_path, ''), //path.basename(filepath),
				ext: path.extname(filepath).toLowerCase().replace('.', ''),
				tags: picTags,
				ts: stats.birthtime.getTime()
			});
		}
	});
	pics.sort(function (a, b) {
		return a.ts > b.ts ? -1 : 1;
	});
	console.log('getPicsList DONE');
	return pics;
};

// ADD TAGS

var addTags = function (filesList, tags) {
	console.log('addTags...');
	console.log('\tAdding tags', tags);
	filesList.forEach(function (filepath, index) {
		var fileTags = path.basename(filepath, path.extname(filepath)).split(' ');
		tags.forEach(function (tag) {
			if (fileTags.indexOf(tag) === -1) {
				fileTags.push(tag);
			}
		});
		fileTags.sort(tagsSorting);
		var newFileName = fileTags.join(' ');
		if (newFileName !== path.basename(filepath, path.extname(filepath))) {
			fs.renameSync(filepath, path.dirname(filepath) + path.sep + newFileName + path.extname(filepath));
		}
	});
	console.log('addTags DONE');
};

// REMOVE TAGS

var removeTags = function (filesList, tags) {
	console.log('removeTags...');
	console.log('\tRemoving tags', tags);
	filesList.forEach(function (filepath, index) {
		var fileTags = path.basename(filepath, path.extname(filepath)).split(' ');
		for (var i = 0; i < fileTags.length; ++i) {
			if (tags.indexOf(fileTags[i]) !== -1) {
				fileTags.splice(i, 1);
				i--;
			}
		}
		fileTags.sort(tagsSorting);
		var newFileName = fileTags.join(' ');
		if (newFileName !== path.basename(filepath, path.extname(filepath))) {
			fs.renameSync(filepath, path.dirname(filepath) + path.sep + newFileName + path.extname(filepath));
		}
	});
	console.log('removeTags DONE');
};
