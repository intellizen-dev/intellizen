zenClass Overload {
  val foo as function(double)void;
  function foo() {}
  function foo(arr as double[]) {}
}
val obj as Overload = Overload();

obj.foo();
obj.foo(1.0);
obj.foo([1.0]);
