var express = require('express');
var http = require('http');
var http = require('http');
var querystring = require('querystring');
var langPairs = require('./langPairs.json');
var path = require('path');
var app = express();
var bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, './', 'index.html'));
});

app.use("/images", express.static(__dirname + '/images'));
app.use("/css", express.static(__dirname + '/css'));
app.use("/js", express.static(__dirname + '/js'));

function callAPI(src, tgt, start, end, data, result, res) {
    var api = langPairs[src][tgt][start];
    var params = api.params;
    params.data = data;
    params.lang = src;
    var postData= querystring.stringify(params);
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
         callAPI(src, tgt, start, end, str, result, res);
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
   if (start <= end) {
        callAPI(src, tgt, start - 1, end, new Buffer(req.body.input).toString('base64'), {}, res);
   } else {
        res.send('{"Error": "Invalid Request"}');
   }
});

var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);
});

