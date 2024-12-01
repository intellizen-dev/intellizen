
val obj as intellizen.test.Overload;

obj.foo();
obj.foo(1);

obj.foo(1, 1);
obj.foo(1, 1.0);

obj.varargs(1);
obj.varargs(1, 2);
obj.varargs(1, 2, 3);

obj.varargs_miss();

obj.optional(1, 2);
obj.optional(1);

obj.optional_miss();

obj.optional_convert(1);
obj.optional_convert(1, 2.0);


obj.varargs_vs_optional(1);
