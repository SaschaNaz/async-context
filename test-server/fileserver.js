"use strict";
var node_static_1 = require("node-static");
var http = require("http");
var fs = require("fs");
var path = require("path");
var files = fs.readdirSync(path.resolve(__dirname, "../test")).filter(function (name) {
    var splitted = name.split('.');
    if (splitted.length < 2) {
        return false;
    }
    return splitted[splitted.length - 1] === "js";
}).map(function (item) { return item.slice(0, -3); });
fs.writeFileSync(path.resolve(__dirname, "list.json"), JSON.stringify(files));
console.log(files.length + " test scripts are found.");
var server = new node_static_1.Server(path.resolve(__dirname, "../"), {
    cache: false,
    headers: { "Cache-Control": "no-store" }
});
console.log("Server opened at: " + server.root);
http.createServer(function (request, response) {
    request.addListener("end", function () {
        console.log("Received a request.");
        server.serve(request, response).addListener("error", function (err) {
            console.log("Error serving " + request.url + ": " + err.status + " " + err.message);
            response.writeHead(err.status, err.headers);
            response.end();
        });
    });
    request.resume();
}).listen(8080);
