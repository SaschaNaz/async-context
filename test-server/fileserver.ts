import { Server, ServerResult } from "node-static";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";

let files = fs.readdirSync(path.resolve(__dirname, "../test")).filter(name => {
	let splitted = name.split('.');
	if (splitted.length < 2) {
		return false;
	}
	return splitted[splitted.length - 1] === "js";
}).map(item => item.slice(0, -3));
fs.writeFileSync(path.resolve(__dirname, "list.json"), JSON.stringify(files));

console.log(`${files.length} test scripts are found.`);

let server = new Server(path.resolve(__dirname, "../"), {
	cache: false,
	headers: { "Cache-Control": "no-store" }
});

console.log(`Server opened at: ${server.root}`);

http.createServer((request, response) => {
	request.addListener("end", () => {
		console.log("Received a request.");
		server.serve(request, response).addListener("error", (err: ServerResult) => {
			console.log(`Error serving ${request.url}: ${err.status} ${err.message}`);
			
			response.writeHead(err.status, err.headers);
			response.end();
		});
	});
	request.resume();
}).listen(8080);