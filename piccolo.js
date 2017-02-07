const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
//const readline = require('readline');
var ProgressBar;
try {
	// npm install progress
	ProgressBar = require('progress');
} catch (e) {}

var showUsage = function () {
	console.log(
`Usage: node piccolo.js [ACTION] [PATH]

Available Actions:
	-r, --rehash [PATH]			rename each file in the given PATH using its own MD5 hex digest, eventually preserving existing tags
	-c, --cleanup [PATH]			show duplicate files
	-a, --addtags=TAG[,TAG...] [PATH]	add tags to files in the given PATH
	-d, --removetags=TAG[,TAG...] [PATH]	remove tags to files in the given PATH
	-m, --map				generate JSON map
	-h, --help				show help
`);
};

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
		fs.accessSync(tmpPath, fs.F_OK);
		var stats = fs.statSync(tmpPath);
		if (stats.isDirectory()) {
			var array = fs.readdirSync(tmpPath);
			array.forEach(function (filename) {
				if (filename.indexOf('.') === 0 || filename === 'map.json') {
					return;
				}
				try {
					fs.accessSync(tmpPath + path.sep + filename, fs.R_OK | fs.W_OK);
					filesList.push(tmpPath + path.sep + filename);
				} catch (e) {}
			});
		} else if (stats.isFile()) {
			try {
				fs.accessSync(tmpPath, fs.R_OK | fs.W_OK);
				filesList.push(tmpPath);
			} catch (e) {}
		}
	} catch (e) {}
}

if (filesList.length === 0) {
	showUsage();
	process.exit(1);
}

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
	console.log('Rehashing');
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
		var digest = crypto.createHash('md5').update(fs.readFileSync(filepath)).digest('hex'), // .substring(0, 6),
			oldTags = path.basename(filepath, path.extname(filepath)).split(' ');
		for (var i = 0; i < oldTags.length; ++i) {
			if (!(/[a-zA-Z0-9_]/.test(oldTags[i]) && !/[0-9]+/.test(oldTags[i]))) {
				oldTags.splice(i, 1);
				i--;
			}
		}
		var newFileName = digest + (oldTags.length !== 0 ? ' ' + oldTags.join(' ') : '') + path.extname(filepath);
		fs.renameSync(filepath, path.dirname(filepath) + path.sep + newFileName);
		if (bar) {
			bar.tick();
		} else {
			console.log('[' + Math.round((index + 1) * 100 / filesList.length) + '%] ' + path.basename(filepath) + ' --> ' + newFileName);
		}
	});
} else if (action === '--cleanup' || action === '-c') {
	/*
	 ######  ##       ########    ###    ##    ## ##     ## ########
	##    ## ##       ##         ## ##   ###   ## ##     ## ##     ##
	##       ##       ##        ##   ##  ####  ## ##     ## ##     ##
	##       ##       ######   ##     ## ## ## ## ##     ## ########
	##       ##       ##       ######### ##  #### ##     ## ##
	##    ## ##       ##       ##     ## ##   ### ##     ## ##
	 ######  ######## ######## ##     ## ##    ##  #######  ##
	*/
	console.log('Cleanup duplicates');
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
			/*
			try {
				fs.unlinkSync(filepath);
				console.log('Removed duplicate:', path.basename(filepath));
			} catch (e) {
				console.error('ERROR removing duplicate:', filepath);
			}
			//*/
		} else {
			hashMap[digest] = [filepath];
		}
		if (bar) {
			bar.tick();
		} else {
			//console.log('[' + Math.round((index + 1) * 100 / filesList.length) + '%] ' + path.basename(filepath));
		}
	});
	console.log('Duplicates found:')
	Object.keys(hashMap).forEach(function (digest) {
		if (hashMap[digest].length !== 1) {
			var array = [];
			hashMap[digest].forEach(function (filepath) {
				array.push(path.basename(filepath));
			});
			console.log(array);
		}
	});
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
	console.log('Add tags', tags);
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
		var oldTags = path.basename(filepath, path.extname(filepath)).split(' ');
		tags.forEach(function (tag) {
			if (oldTags.indexOf(tag) === -1) {
				oldTags.push(tag);
			}
		});
		var newFileName = oldTags.join(' ') + path.extname(filepath);
		fs.renameSync(filepath, path.dirname(filepath) + path.sep + newFileName);
		if (bar) {
			bar.tick();
		} else {
			console.log('[' + Math.round((index + 1) * 100 / filesList.length) + '%] ' + path.basename(filepath) + ' --> ' + newFileName);
		}
	});
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
	console.log('Remove tags', tags);
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
		var oldTags = path.basename(filepath, path.extname(filepath)).split(' ');
		for (var i = 0; i < oldTags.length; ++i) {
			if (tags.indexOf(oldTags[i]) !== -1) {
				oldTags.splice(i, 1);
				i--;
			}
		}
		var newFileName = oldTags.join(' ') + path.extname(filepath);
		fs.renameSync(filepath, path.dirname(filepath) + path.sep + newFileName);
		if (bar) {
			bar.tick();
		} else {
			console.log('[' + Math.round((index + 1) * 100 / filesList.length) + '%] ' + path.basename(filepath) + ' --> ' + newFileName);
		}
	});
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
	console.log('Generating JSON map');
	var json = {
		pics: {},
		tags: {}
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
			hash: hash,
			tags: tags,
			ts: stats.birthtime.getTime()
		};
		tags.forEach(function (tag) {
			if (!json.tags[tag]) {
				json.tags[tag] = [hash];
			} else {
				json.tags[tag].push(hash);
			}
		});
		if (bar) {
			bar.tick();
		}
	});
	var filecontent = JSON.stringify(json);
	fs.writeFileSync(path.dirname(filesList[0]) + path.sep + 'map.json', filecontent);
	console.log('JSON map generated.');
} else if (action === '--help' || action === '-h') {
	showUsage();
} else {
	showUsage();
	process.exit(1);
}
