const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const hostname = '127.0.0.1';
const port = process.argv[2] ? parseInt(process.argv[2], 10) : 3000;

const server = http.createServer((request, response) => {
	//console.log('request.httpVersion', request.httpVersion);
	//console.log('request.method', request.method);
	console.log('request.url', request.url);
	//console.log('request.headers', request.headers);

	const parsed_url = new URL(`http://${hostname}:${port}${request.url}`);

	if (parsed_url.pathname === '/') {
		response.statusCode = 200;
		response.statusMessage = 'OK';
		response.setHeader('Content-Type', 'text/html');
		response.end('<html><head><meta charset="utf-8"><title>Piccolo</title></head><body><h1>Piccolo</h1></body></html>\n');
	} else if (parsed_url.pathname === '/rehash') {
		const request_path = parsed_url.searchParams.get('path');
		if (!request_path) {
			returnHTTPError(response, 500, 'Internal Error');
		} else {
			var filesList = getFilesList(request_path);
			rehash(filesList);
			response.statusCode = 200;
			response.statusMessage = 'OK';
			response.setHeader('Content-Type', 'application/json');
			response.end('{"status":"ok"}\n');
		}
	} else if (parsed_url.pathname === '/map') {
		const request_path = parsed_url.searchParams.get('path');
		if (!request_path) {
			returnHTTPError(response, 500, 'Internal Error');
		} else {
			var filesList = getFilesList(request_path),
				json = getMap(filesList);
			response.statusCode = 200;
			response.statusMessage = 'OK';
			response.setHeader('Content-Type', 'application/json');
			response.end(JSON.stringify(json) + '\n');
		}
	} else {
		returnHTTPError(response, 404, 'Not Found');
	}
});

server.listen(port, hostname, () => {
	console.log(`Server running at http://${hostname}:${port}/\nCTRL + C to shutdown`);
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
		fs.accessSync(tmpPath, fs.F_OK);
		var stats = fs.statSync(tmpPath);
		if (stats.isDirectory()) {
			var array = fs.readdirSync(tmpPath);
			array.forEach(function (filename) {
				if (filename.indexOf('.') === 0 || filename === 'map.json') {
					return;
				}
				try {
					var stats = fs.statSync(tmpPath + path.sep + filename);
					if (stats.isFile()) {
						fs.accessSync(tmpPath + path.sep + filename, fs.R_OK | fs.W_OK);
						filesList.push(tmpPath + path.sep + filename);
					}
				} catch (e) {}
			});
		} else if (stats.isFile()) {
			try {
				fs.accessSync(tmpPath, fs.R_OK | fs.W_OK);
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

// REHASH

var rehash = function (filesList) {
	console.log('Searching duplicates...');
	var timestamp = Date.now();
	var hashMap = Object.create(null);
	filesList.forEach(function (filepath, index) {
		var digest = crypto.createHash('md5').update(fs.readFileSync(filepath)).digest('hex'); // .substring(0, 6);
		if (hashMap[digest]) {
			hashMap[digest].push(filepath);
			if (!bar) {
				console.log('Found duplicate file ' + path.basename(filepath));
			}
		} else {
			hashMap[digest] = [filepath];
		}
	});
	console.log('Duplicates search completed in ' + ((Date.now() - timestamp) / 1000) + ' seconds.');
	console.log('Rehashing files...');
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
					console.log('Name "' + newFileName + '" too long, reduced to "' + digest + '"');
					newFileName = digest;
				}
				if (newFileName !== path.basename(filepath, path.extname(filepath))) {
					fs.renameSync(filepath, path.dirname(filepath) + path.sep + newFileName + path.extname(filepath));
				}
				rehashCount++;
			} else {
				try {
					fs.unlinkSync(filepath);
					console.log('Removed duplicate file ' + path.basename(filepath));
					duplicateCount++;
				} catch (e) {
					console.error('Error: An error occurred removing duplicate file ' + filepath);
				}
			}
		});
	});
	console.log('Rehashing completed in ' + ((Date.now() - timestamp) / 1000) + ' seconds.');
	console.log(rehashCount + ' files has been rehashed.');
	console.log(duplicateCount + ' duplicated files has been removed.');
};

// ADD TAGS

var addTags = function (filesList, tags) {
	console.log('Adding tags', tags);
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
	console.log('Tags added.');
};

// REMOVE TAGS

var removeTags = function (filesList, tags) {
	console.log('Removing tags', tags);
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
	console.log('Tags removed.');
};

// MAP

var getMap = function (filesList) {
	console.log('Generating JSON map...');
	var json = {
		pics: {},
		tags: {
			'TAGME': []
		}
	};
	filesList.forEach(function (filepath, index) {
		var tags = path.basename(filepath, path.extname(filepath)).split(' '),
			hash = tags[0];
		tags.splice(0, 1);
		var stats = fs.statSync(filepath);
		json.pics[hash] = {
			//hash: hash,
			path: filepath,
			tags: tags,
			ts: stats.birthtime.getTime()
		};
		if (tags.length === 0) {
			json.tags.TAGME.push(hash);
		} else {
			tags.forEach(function (tag) {
				if (!json.tags[tag]) {
					json.tags[tag] = [hash];
				} else {
					json.tags[tag].push(hash);
				}
			});
		}
	});
	console.log('JSON map generated');
	return json;
};
