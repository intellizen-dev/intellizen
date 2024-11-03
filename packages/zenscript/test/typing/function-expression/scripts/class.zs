zenClass BiConsumer {
    lambda function(x as float, y as double) as void;
}

function apply(fn as BiConsumer) as void {}

/* Begin Test */
var consumer as BiConsumer = function(x, y) {};
consumer = function(u, v) {};
apply(function(i, j) {});
