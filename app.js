var http = require('http');
var deepcopy = require('deepcopy');
var querystring = require('querystring');
var langPairs = require('./langPairs.json');
var path = require('path');
var bodyParser = require('body-parser');
var cluster = require('cluster');

// Code to run if we're in the master process
if (cluster.isMaster) {

    // Count the machine's CPUs
    var cpuCount = require('os').cpus().length;

    // Create a worker for each CPU
    for (var i = 0; i < cpuCount; i += 1) {
        cluster.fork();
    }

    // Listen for dying workers
    cluster.on('exit', function (worker) {

        // Replace the dead worker, we're not sentimental
        console.log('Worker ' + worker.id + ' died :(');
        cluster.fork();

    });

// Code to run if we're in a worker process
} else {

    // Include Express
    var express = require('express');

    // Create a new Express application
    var app = express();

    app.use(bodyParser.urlencoded({ extended: true }));

    app.get('/', function (req, res) {
      res.sendFile(path.join(__dirname, './', 'index.html'));
    });

    app.use("/images", express.static(__dirname + '/images'));
    app.use("/css", express.static(__dirname + '/css'));
    app.use("/js", express.static(__dirname + '/js'));

    function callAPI(src, tgt, start, end, userParams, result, res) {
        var api = langPairs[src][tgt][start];
        var params = deepcopy(api.params);
        params.src_lang = src;
        params.tgt_lang = tgt;
        Object.keys(userParams).forEach(function(key) {
              params[key] = userParams[key];
        });
        /* Backwards compatibility: User can pass sentence in param key in {data, input} */
        if (!params.data) {
            params.data = params.input;
            delete params.input;
        }
        var postData = querystring.stringify(params);
        var options = {
              hostname: 'localhost',
              port: 5000,
              path: '/' + api.funcName,
              method: 'POST',
              headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'Content-Length': postData.length
              }
        };
        start += 1;
        callback = function(response) {
         var str = ''
         response.setEncoding('utf8');
         response.on('data', function (chunk) {
           str += chunk;
         });
         response.on('end', function () {
           result[api.funcName + "-" + start] = new Buffer(str, 'base64').toString();
           if (start == end) {
              res.send(result);
           } else {
             userParams = {};
             userParams.data = str;
             callAPI(src, tgt, start, end, userParams, result, res);
           }
         });
       }
       var httpreq = http.request(options, callback);

       httpreq.write(postData);
       httpreq.end();
    }

    app.get('/:src/:tgt/', function (req, res) {
       var src = req.params.src,
           tgt = req.params.tgt;
        res.send("" +langPairs[src][tgt].length);
    });

    app.post('/:src/:tgt/:start/:end', function (req, res) {
       var src = req.params.src,
           tgt = req.params.tgt,
           start = Number(req.params.start),
           end = Number(req.params.end);

       //console.log("Request received by worker:" +  cluster.worker.id);

       req.body.input = new Buffer(req.body.input).toString('base64');

       if (start <= end) {
            callAPI(src, tgt, start - 1, end, req.body, {}, res);
       } else {
            res.send('{"Error": "Invalid Request"}');
       }
    });

    app.get('/langpairs', function (req, res) {
        var lp = {};
        for (var src in langPairs) {
            lp[src] = [];
                for (var tgt in langPairs[src]) {
                    lp[src].push(tgt);
                }
        }
        res.send(lp);
    });

    app.get('/:src/:tgt/modules', function (req, res) {
        var modules = [];
        var src = req.params.src,
            tgt = req.params.tgt;
        for (var module in langPairs[src][tgt]) {
            modules.push(langPairs[src][tgt][module]['funcName']);
        }
        res.send(modules);
    });

    // Bind to a port
    app.listen(3000);

    console.log('Worker ' + cluster.worker.id + ' running!');
}
