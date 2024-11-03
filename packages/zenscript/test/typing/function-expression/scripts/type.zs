function apply(fn as function(int)void) as void {}

/* Begin Test */
var consumer as function(int)void = function(z) {};
consumer = function(w) {};
apply(function(k) {});
