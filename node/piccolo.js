const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
//const readline = require('readline');
var ProgressBar;
try {
	// npm install progress
	ProgressBar = require('progress');
} catch (e) {}

//###############################################################
//###############################################################
//###############################################################

var showUsage = function () {
	console.log(
`Usage: node piccolo.js [ACTION] [PATH]

Available Actions:
	-r, --rehash [PATH]			rename each file in the given PATH using its own MD5 hex digest, eventually preserving existing tags
	-a, --addtags=TAG[,TAG...] [PATH]	add tags to files in the given PATH
	-d, --removetags=TAG[,TAG...] [PATH]	remove tags to files in the given PATH
	-m, --map				generate JSON map
	-h, --help				show help
`);
};

var tagsSorting = function (a, b) {
	if (a.toLowerCase() < b.toLowerCase()) {
		return -1;
	} else if (a.toLowerCase() > b.toLowerCase()) {
		return 1;
	} else if (a < b) {
		return -1;
	} else if (a > b) {
		return 1;
	} else {
		0
	}
};

//###############################################################
//###############################################################
//###############################################################

/*
process.argv.forEach(function (val, index, array) {
	console.log(`${index}: ${val}`);
});
*/

const action = process.argv[2];

var filesList = [];

if (process.argv.length > 2) {
	var tmpPath = process.argv[process.argv.length - 1];
	if (!path.isAbsolute(tmpPath)) {
		tmpPath = path.resolve(tmpPath);
	}
	try {
		fs.accessSync(tmpPath, fs.constants.F_OK);
		var stats = fs.statSync(tmpPath);
		if (stats.isDirectory()) {
			var array = fs.readdirSync(tmpPath);
			array.forEach(function (filename) {
				if (filename.indexOf('.') === 0 || filename === 'map.json') {
					return;
				}
				try {
					fs.accessSync(tmpPath + path.sep + filename, fs.constants.R_OK | fs.constants.W_OK);
					filesList.push(tmpPath + path.sep + filename);
				} catch (e) {}
			});
		} else if (stats.isFile()) {
			try {
				fs.accessSync(tmpPath, fs.constants.R_OK | fs.constants.W_OK);
				filesList.push(tmpPath);
			} catch (e) {}
		}
	} catch (e) {}
}

if (filesList.length === 0) {
	console.error('Error: No files on input.');
	showUsage();
	process.exit(1);
}

//###############################################################
//###############################################################
//###############################################################

if (action === '--rehash' || action === '-r') {
	/*
	########  ######## ##     ##    ###     ######  ##     ##
	##     ## ##       ##     ##   ## ##   ##    ## ##     ##
	##     ## ##       ##     ##  ##   ##  ##       ##     ##
	########  ######   ######### ##     ##  ######  #########
	##   ##   ##       ##     ## #########       ## ##     ##
	##    ##  ##       ##     ## ##     ## ##    ## ##     ##
	##     ## ######## ##     ## ##     ##  ######  ##     ##
	*/
	console.log('Searching duplicates...');
	var timestamp = Date.now();
	var bar;
	if (ProgressBar) {
		bar = new ProgressBar(':percent :etas [:bar]', {
			complete: '=',
			incomplete: ' ',
			width: 50,
			total: filesList.length
		});
	}
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
		if (bar) {
			bar.tick();
		} else {
			//console.log('[' + Math.round((index + 1) * 100 / filesList.length) + '%] ' + path.basename(filepath));
		}
	});
	console.log('Duplicates search completed in ' + ((Date.now() - timestamp) / 1000) + ' seconds.');
	console.log('Rehashing files...');
	timestamp = Date.now();
	if (ProgressBar) {
		bar = new ProgressBar(':percent :etas [:bar]', {
			complete: '=',
			incomplete: ' ',
			width: 50,
			total: Object.keys(hashMap).length
		});
	}
	var rehashCount = 0,
		duplicateCount = 0;
	Object.keys(hashMap).forEach(function (digest) {
		var array = [];
		hashMap[digest].forEach(function (filepath) {
			var fileTags = path.basename(filepath, path.extname(filepath)).split(' ');
			fileTags.forEach(function (tag) {
				if (/^[a-zA-Z0-9\'\"\-\_]+$/g.test(tag) && !(tag.length === 32 && /^[a-z0-9]+$/g.test(tag)) && array.indexOf(tag) === -1) {
					array.push(tag);
				}
			});
		});
		array.sort(tagsSorting);
		hashMap[digest].forEach(function (filepath, index) {
			if (index === 0) {
				var newFileName = digest + (array.length !== 0 ? ' ' + array.join(' ') : '');
				if (newFileName.length + path.extname(filepath) > 255) {
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
		if (bar) {
			bar.tick();
		}
	});
	console.log('Rehashing completed in ' + ((Date.now() - timestamp) / 1000) + ' seconds.');
	console.log(rehashCount + ' files has been rehashed.');
	console.log(duplicateCount + ' duplicated files has been removed.');
} else if (action.indexOf('--addtags') === 0 || action.indexOf('-a') === 0) {
	/*
	   ###    ########  ########     ########    ###     ######    ######
	  ## ##   ##     ## ##     ##       ##      ## ##   ##    ##  ##    ##
	 ##   ##  ##     ## ##     ##       ##     ##   ##  ##        ##
	##     ## ##     ## ##     ##       ##    ##     ## ##   ####  ######
	######### ##     ## ##     ##       ##    ######### ##    ##        ##
	##     ## ##     ## ##     ##       ##    ##     ## ##    ##  ##    ##
	##     ## ########  ########        ##    ##     ##  ######    ######
	*/
	var tags = action.split('=')[1].split(',');
	console.log('Adding tags', tags);
	var bar;
	if (ProgressBar) {
		bar = new ProgressBar(':percent :etas [:bar]', {
			complete: '=',
			incomplete: ' ',
			width: 50,
			total: filesList.length
		});
	}
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
		if (bar) {
			bar.tick();
		} else {
			console.log('[' + Math.round((index + 1) * 100 / filesList.length) + '%] ' + path.basename(filepath) + ' --> ' + newFileName);
		}
	});
	console.log('Tags added.');
} else if (action.indexOf('--removetags') === 0 || action.indexOf('-d') === 0) {
	/*
	########  ######## ##     ##  #######  ##     ## ########    ########    ###     ######    ######
	##     ## ##       ###   ### ##     ## ##     ## ##             ##      ## ##   ##    ##  ##    ##
	##     ## ##       #### #### ##     ## ##     ## ##             ##     ##   ##  ##        ##
	########  ######   ## ### ## ##     ## ##     ## ######         ##    ##     ## ##   ####  ######
	##   ##   ##       ##     ## ##     ##  ##   ##  ##             ##    ######### ##    ##        ##
	##    ##  ##       ##     ## ##     ##   ## ##   ##             ##    ##     ## ##    ##  ##    ##
	##     ## ######## ##     ##  #######     ###    ########       ##    ##     ##  ######    ######
	*/
	var tags = action.split('=')[1].split(',');
	console.log('Removing tags', tags);
	var bar;
	if (ProgressBar) {
		bar = new ProgressBar(':percent :etas [:bar]', {
			complete: '=',
			incomplete: ' ',
			width: 50,
			total: filesList.length
		});
	}
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
		if (bar) {
			bar.tick();
		} else {
			console.log('[' + Math.round((index + 1) * 100 / filesList.length) + '%] ' + path.basename(filepath) + ' --> ' + newFileName);
		}
	});
	console.log('Tags removed.');
} else if (action === '--map' || action === '-m') {
	/*
	      ##  ######   #######  ##    ##    ##     ##    ###    ########
	      ## ##    ## ##     ## ###   ##    ###   ###   ## ##   ##     ##
	      ## ##       ##     ## ####  ##    #### ####  ##   ##  ##     ##
	      ##  ######  ##     ## ## ## ##    ## ### ## ##     ## ########
	##    ##       ## ##     ## ##  ####    ##     ## ######### ##
	##    ## ##    ## ##     ## ##   ###    ##     ## ##     ## ##
	 ######   ######   #######  ##    ##    ##     ## ##     ## ##
	*/
	console.log('Generating JSON map...');
	var json = {
		pics: {},
		tags: {
			'TAGME': []
		}
	};
	var bar;
	if (ProgressBar) {
		bar = new ProgressBar(':percent :etas [:bar]', {
			complete: '=',
			incomplete: ' ',
			width: 50,
			total: filesList.length
		});
	}
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
		if (bar) {
			bar.tick();
		}
	});
	var filecontent = JSON.stringify(json),
		filepath = path.dirname(filesList[0]) + path.sep + 'map.json';
	fs.writeFileSync(filepath, filecontent);
	console.log('JSON map generated: ' + filepath);
} else if (action === '--help' || action === '-h') {
	showUsage();
} else {
	console.error('Error: Invalid action ' + action);
	showUsage();
	process.exit(1);
}
