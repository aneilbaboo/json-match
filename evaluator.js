import { isArray, isFunction, isObject} from 'util';
import {Capture, isCapture, isSuccess, alias} from './utils';

/**
 * evalPattern - description
 *
 * @param  {type} path    description
 * @param  {type} pattern description
 * @param  {type} data    description
 * @return {type}         undefined = failure
 *                        value = success
 *                        value may be a Capture instance
 */
export function evalPattern(path, pattern, data, options) {
  if (pattern.$$alias) {
    options = {
      ...options,
      ops: alias(options.ops, pattern.$$alias),
      aggregators: alias(options.aggregators, pattern.$$alias)};
  }
  // console.log('1 evalPattern path:%j data:%j pattern:', path, data,  pattern);

  if (isArray(data)) {
    return evalPatternOnArray(path, pattern, data, options);
  } else {
    return evalItemPattern(path, pattern, data, options);
  }
}


function evalItemPattern(path, pattern, data, options) {
  // console.log(">>>>>>>> evalItemPattern %j pattern:", path, pattern);
  var captures;
  for (var pkey in pattern) {
    var pval = pattern[pkey];
    // console.log('2a evalItemPattern calling getTest with pkey:%s, args:', pkey, pval);
    var test = getTest(options.ops, pkey, pval, options);
    var result = null;
    // console.log("2b *********** ACCESSING DATA: %j[%s]", data, pkey);
    // console.log('2c in pattern', pattern, 'getTest(pkey:', pkey,'pval:',pval,'=> test:', test);

    if (test) {
      // If we are executing a test, we do not descend a level in the data
      // E.g., Given
      //    pattern: {b: {$isNumber: true} }
      //    data: {b: 1}
      // when pkey = $isNumber, data = 1
      // console.log('3a checking key %s pattern %j against data:%j ', pkey, pval, data, test);

      result = test(data, path);
      // console.log('3b result from test(%j,%j)=>', data, path, result);
    } else {
      // descend a level in the data
      var dval = data[pkey];
      path = [...path, pkey];
      if (isObject(pval)) {
        //
        // Pattern match the value
        //
        // console.log('3a recursively testing key %s pattern %j against %j => %s', pkey, pval, dval, result);
        result = evalPattern(path, pval, data[pkey], options);
        // console.log('3b result from evalPattern(%j,%j,%j)=>%j', path, pval, dval, result);
      } else if (isFunction(pval)){
        //
        // Execute a predicate on the value
        //
        result = pval(dval);
        // console.log('3b evaluating function %s(%j)=>%j / function=', pval.name, dval, result, pval);
      } else {
        //
        // Otherwise, just test for equality
        //
        result = (pval==data[pkey]);
        // console.log('3b equality testing key %s pattern %j against %j => %s', pkey, pval, dval, result);
      }

    }

    // terminate pattern matching if the result is falsey, but not 0
    if (!isSuccess(result)) {
      // console.log('4a failed -- returning undefined result');
      return result;
    } else {
      // console.log('4b result is ok:', result);
    }

    if (isCapture(result)) {
      captures = captures || {};
      result = result.value;
      Object.assign(captures, result.bindings);
    }
  }

  if (captures) {
    // console.log('returning Capture(true, %j)', captures);
    return new Capture(result, captures);
  } else {
    // console.log('returning result', result);
    return result;
  }
}

function onlyMatchFirst(pattern, options) {
  if (pattern.hasOwnProperty('$first')) {
    pattern = {...pattern};
    delete pattern.$first;
    return pattern.$first;
  } else {
    return options.first;
  }
}

function extractArrayPattern(pattern, options) {
  // extract aggregator ops from the pattern
  var itemPattern = {};
  var aggregationOps = [];
  var first = onlyMatchFirst(pattern, options);

  for (var pkey in pattern) {
    var pval = pattern[pkey];
    var aggOp = getTest(options.aggregators, pkey, pval, options);
    if (aggOp) {
      aggregationOps.push(aggOp);
    } else {
      itemPattern[pkey] = pval;
    }
  }

  return [itemPattern, aggregationOps, first];
}

function evalPatternOnArray(path, pattern, array, options) {

  var [itemPattern, agOps, first] = extractArrayPattern(pattern, options);
  var results = [];

  // find a matching items
  for (let i=0; i<array.length; i++) {
    let elt = array[i];
    let result = evalPattern([path, ...i], itemPattern, elt);
    if (isSuccess(result)) {
      results.push(result);
      if (first) { // requested to get only the first result
        break;
      }
    }
  }

  // evaluate each aggregate operation
  for (let i=0; i<agOps.length; i++) {
    let agOp = agOps[i];
    let result = agOp(array, path);
    if (!result) { // if any aggregate op fails, the match fails
      return undefined;
    }

    results.push(result);
  }

  // there must be results for the match to be considered a success
  if (results.length>0) {
    return combineResults(array, results);
  }
}

function combineResults(value, results) {
  var captures = {};
  for (var i=0; i<results.length; i++) {
    let result = results[i];
    if (isCapture(result)) {
      Object.assign(captures, ...result.bindings);
    }
  }
  if (Object.keys(captures).length>0) {
    return new Capture(value, captures);
  } else {
    return value;
  }
}

function normalizeArgs(ops, args) {
  // console.log('normalizing args: %j', args);
  if (isArray(args)) {
    return args;
  } else if (args!=undefined) {
    return [args];
  } else {
    return [];
  }
}

function normalizeTestResultValue(result) {
  return isCapture(result) ? result.value : result;
}

function makeSecondOrderTest(op, pattern, options) {

  // extract the actual op args from the pattern
  pattern = {...pattern}; // we need to modify the pattern
  var args = normalizeArgs(pattern.args); //
  delete pattern.args;

  var test = op(...args);

  // a test which gets the test result and applies the pattern to the result
  return function (data, path) {
    var testResult = test(data, path);

    return evalPattern(path, pattern, normalizeTestResultValue(testResult), options);
  };
}


/**
 * getTest - returns a function of the form fn(data, path)
 *    A test returns a defined value on success.
 *    If values have been captured during the matching, it returns a Capture instance,
 *    which contains both the value of the test plus the captured variables
 *
 * @param  {type} ops     description
 * @param  {type} opName  description
 * @param  {type} args    description
 * @param  {type} options description
 * @return {type}         description
 */
function getTest(ops, opName, args, options) {
  // console.log("1 getTest opName:%s args:%s", opName, args);
  var op = ops[opName];
  if (op) {
    if (isObject(args)) {
      // a test which tests the pattern result
      // used in a case like this:
      // match({ myarray: { _$count: { $lte: 5} }}, {myarray: [1,2,3]}); // => {} success
      // match({ myarray: { _$count: { $gte: 5} }}, {myarray: [1,2,3]}); // => null fail
      return makeSecondOrderTest(op, args, options);
    } else if (args==false) {
      // syntactic sugar for inverting the value of a predicate:
      // e.g., match({ val: { $isNumber: false}}, { val:"not a num!" }); // => {} success
      return function (data, path) { return !op(...normArgs)(data, path); };
    } else {
      // console.log("1.5 getTest args:%j", args);
      var normArgs = normalizeArgs(ops, args);
      return op(...normArgs);
    }
  }
}
