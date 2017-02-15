const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const port = process.argv[2] ? parseInt(process.argv[2], 10) : 8888;

const server = http.createServer(function (request, response) {
	console.log('Request:', request.url);
	var uri = url.parse(request.url).pathname,
		filename = path.join(process.cwd(), uri);
	fs.exists(filename, function (exists) {
		if (!exists) {
			response.writeHead(404, { 'Content-Type': 'text/plain' });
			response.write('404 Not Found\n');
			response.end();
		} else {
			if (fs.statSync(filename).isDirectory()) {
				filename += '/index.html';
			}
			fs.readFile(filename, 'binary', function (error, file) {
				if (error) {
					response.writeHead(500, { 'Content-Type': 'text/plain' });
					response.write(error + '\n');
					response.end();
				} else {
					response.writeHead(200);
					response.write(file, 'binary');
					response.end();
				}
			});
		}
	});
});

server.listen(port, function (error) {
	if (error) {
		console.log('ERROR: server.listen', error);
	} else {
		console.log('Server is running on http://localhost:', port);
		console.log('CTRL + C to shutdown');
	}
});
