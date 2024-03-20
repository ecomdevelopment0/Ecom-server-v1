import ErrorHandler from "./errorHandler.js";
const asyncErrorHandler = (func) => (req, res, next) => 
   
    func(req, res, next).catch(err=> 
        next(new ErrorHandler(err,"internal server error", 500)));


export default asyncErrorHandler