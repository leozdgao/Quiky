var arg = Array.prototype.concat.apply([], process.argv).join(' ');
var matches = arg.match(/-n\s*([^\s]*)/);
if(matches != null) var _name = matches[1];
matches = arg.match(/-v\s*([^\s]*)/);
if(matches != null) var _version = matches[1];

// exit if name is not provided
if(typeof _name == 'undefined') {
	console.log('You should speciy the library name by using -n {name}');
	process.exit(0);
}

// load modules
var _fs = require('fs');
var _path = require('path');
var _url = require('url');

var cheerio = require('cheerio');
var superagent = require('superagent');
var async = require('async');
var mkdirp = require('mkdirp');
var config = require('./config');

var _cache = {};

exports.exec = function() {
    console.log('Getting available libraries list...');

    // get available libraries and versions
    superagent.get(config.targetHost).end(function(err, res) {
        if(err) {
            console.log('Get available libraries failed. Detail: %s', err);
            process.exit(0);
        }

        console.log('Available libraries getted.');
        console.log('Start mapping libraries...');

        // parse html to get available libraries
        var $ = cheerio.load(res.text);
        $('#wrap div.packages-table-container a').each(function(){
            var ele = $(this);
            var text = ele.text();
            if(typeof text == 'string') {
                var matches = text.match(/^(.*)\((.*)\)/);
                var name = matches[1];
                var lastversion = matches[2];

                _cache[name] = {
                    lastversion: lastversion,
                    href: ele.attr('href')
                }
            }
            else {
                console.log('Mapping libraries failed.');
                process.exit(0);
            }
        });

        // check the library is available or not
        if(Object.keys(_cache).indexOf(_name) < 0) {
            console.log('Library %s is not available.', _name);
            process.exit(0);
        }

        var targetUrl = _url.resolve(config.targetHost, _cache[_name].href);
        var dest = _path.resolve(process.cwd(), config.dest);
        console.log('Spider start. Fetch from %s.', targetUrl);
        console.log('Put result to %s.', dest);

        console.log('Fetching...');
        superagent.get(targetUrl).end(function(err, res) {
            if (err) return console.log('Failed. Detail: %s', err);

            console.log('Page fetched.');
            console.log('Page loading...');

            // TODO get right version

            var $ = cheerio.load(res.text);
            var availVersions = [];
            var targetVersion = "", selector = "", index = 0;

            // map version if version is not provided
            if(typeof _version == 'undefined') targetVersion = $('#wrap .container h3:first-child').text();
            else {
                // map versions
                $('#wrap .container h3').each(function() {
                    availVersions.push($(this).text());
                });

                // exit if the version is not available
                index = availVersions.indexOf(_version);
                if(index < 0) {
                    console.log('The version you provided is not available.');
                    process.exit(0);
                }
                else targetVersion = _version;
            }

            selector = '#wrap .container table.table:nth-child(' + (index + 1) * 2 + ') p.library-url';

            console.log('Target version: %s', targetVersion);

            var filetargets = [];

            console.log('Getting file targets for v%s...', targetVersion);

            // get available files
            $(selector).each(function() {
                filetargets.push($(this).text());
            });

            console.log('File targets getted.');
            console.log('Start fetching files... limit: %s', config.concurrencyLimit);

            // download files
            async.mapLimit(filetargets, config.concurrencyLimit, function(url, callback) {
                var destPath = _path.join(dest, url.replace(/^http:\/\/cdn.bootcss.com/, '')), destDir;

                // windows
                if(process.platform == 'win32') destDir = destPath.slice(0, destPath.lastIndexOf('\\'));
                // linux
                else destDir = destPath.slice(0, destPath.lastIndexOf('/'));

                if(!_fs.existsSync(destDir)) mkdirp.sync(destDir);

                var req = superagent.get(url);
                req.pipe(_fs.createWriteStream(destPath));
                req.on('error', function(err){
                    callback(err);
                });
                req.on('end', function(){
                    console.log('Get ', destPath);
                    callback();
                });
            }, function(err, result){
                if(err) console.log(err);
                else console.log('Finished.');
            });
        });
    });
}



