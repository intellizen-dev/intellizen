function createLogHelper() as LogHelper {
    return LogHelper();
}

zenClass LogHelper {
    static default = LogHelper();
    static function create() as LogHelper { return LogHelper(); }
}
