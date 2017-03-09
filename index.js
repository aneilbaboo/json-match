import {isString, isArray, isNumber, isFunction, isObject} from 'util';
import format from 'string-format';

/**
 * match - returns Su
 *
 * @param  {type} pattern description
 * @param  {type} data    description
 * @param  {type} options
 * @param  {boolean} options.first  if true (default) only match the first element of an array
 * @return {type}         returns has of captured values on success or null
 */
export function match(pattern, data, options) {
  options = {...DEFAULT_OPTIONS, ...(options || {})};
  var aliases = options.aliases;
  if (aliases) {
    options.ops = alias(options.ops, aliases);
    options.aggregators = alias(options.aggregators, aliases);
  }
  var result = evalPattern([], pattern, data, options);
  if (isCapture(result)) {
    return result.bindings;
  } else if (isSuccess(result)) {
    return {};
  } else {
    return null; // no matches
  }
}


/**
 * alias - renames the keys in ops according to the mapping in aliases
 *
 * @param  {type} ops     an object mapping operator names to definitions
 * @param  {type} aliases a map of existing operator names to new operator names
 * @return {type}         returns a modified copy of ops
 */
export function alias(ops, aliases) {
  ops = {...ops}; // modify the copy
  for (var k in aliases) {
    var opvalue = ops[k];
    var alias = aliases[k];
    if (opvalue) {
      ops[alias] = opvalue;
      delete ops[k];
    }
  }
  return ops;
}

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
function evalPattern(path, pattern, data, options) {
  if (pattern.$$alias) {
    options = {
      ...options,
      ops: alias(options.ops, pattern.$$alias),
      aggregators: alias(options.aggregators, pattern.$$alias)};
  }
  console.log('evalPattern path:%j pattern:%j data:%j options:%j', path, pattern, data, options);

  if (isArray(data)) {
    return evalPatternOnArray(path, pattern, data, options);
  } else {
    var captures;
    for (var pkey in pattern) {
      var pval = pattern[pkey];
      var test = getTest(options.ops, pkey, pval, options);
      var result = null;
      var dval = data[pkey];
      if (!test) {
        path = [...path, pkey];
      }

      if (test) {
        console.log('checking key %s pattern %j against %j with op %s ',
          pkey, pval, dval, test);

        result = test(data, path);
        console.log('result from test(%j,%j)=>', data, path, result);
      } else if (isObject(pval)){
        console.log('recursively testing key %s pattern %j against %j => %s',
          pkey, pval, dval, result);
        result = evalPattern(path, pval, dval, options);
        console.log('result from evalPattern(%j,%j,%j)=>%j', path, pval, dval, result);
      } else if (isFunction(pval)){
        result = pval(dval);
        console.log('function testing key %s pattern %j against %j => %s',
          pkey, pval, dval, result);
      } else {
        result = pval==dval;
        console.log('equality testing key %s pattern %j against %j => %s',
          pkey, pval, dval, result);
      }

      if (result==undefined || result==false) {
        console.log('failed -- returning undefined result');
        return undefined;
      }

      if (isCapture(result)) {
        captures = captures || {};
        Object.assign(captures, result.bindings);
      }
    }
    if (captures) {
      console.log('returning Capture(true, %j)', captures);
      return new Capture(true, captures);
    } else {
      console.log('returning true');
      return true;
    }
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

//
// Results returned from tests
//
export function Capture(value, captures) {
  this.value = value;
  this.bindings = captures;
}

function isCapture(o) {
  return o && o.constructor==Capture;
}

function isSuccess(o) {
  return o!=undefined ? true : false;
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

function normalizeArgs(args) {
  return args ? (isArray(args) ? args : [args]) : [];
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
  console.log("getTest ops:%j opName:%s args:%args", ops, opName, args, options);
  var op = ops[opName];
  if (op) {
    if (isObject(args)) { // we need to perform a test on the results of the test
      return makeSecondOrderTest(op, args, options);
    } else {
      return op(...normalizeArgs(args));
    }
  }
}

export function pathToArray(path) { return isString(path) ? path.split('.') : path; }
export function pathToString(path) { return isArray(path) ? path.join('.') : path; }
export function pathIndex(path) { return path[path.length -1]; }
export function pathParent(path) { return path.slice(0, path.length -1); }

function makeCaptureTest(outputKey) {
  return function (data, path) {
    if (isString(outputKey)) {
      outputKey = format(outputKey, {
        parent:pathParent(path),
        index:pathIndex(path),
        path: path
      });
    } else {
      outputKey = pathToString(path);
    }
    var captures = {};
    captures[outputKey] = data;
    return new Capture(true, captures);
  };
}

function makeAndTest(patterns) {

}

function makeOrTest(patterns) {
}

export const DEFAULT_MACROS = {
  $and(...patterns) {
    return makeAndTest(patterns);
  },
  $or(...patterns) {
    return;
  },
  $if(condition, thenPattern, elsePattern) {
    return function (data, path) {

    }
  }
};

export const DEFAULT_OPERATORS = {
  $gt(n) { return (data)=>data>n; },
  $lt(n) { return (data)=>data<n; },
  $gte(n) { return (data)=>data>=n; },
  $lte(n) { return (data)=>data<=n; },
  $isNull() { return (data)=>data==null; },
  $truthy() { return (data)=>!!data; },
  $falsey() { return (data)=>!data; },
  $equals(v) { return (data)=>data==v; },
  $isArray() { return isArray; },
  $isNumber() { return isNumber; },
  $isString() { return isString; },
  $isFunction() { return isFunction; },
  $match(pattern) { // useful for matching sub-arrays
                    // e.g., match a subarray of count 3 { array:{ $match: [{$isArray:true, _$count:{$gte:3}}] } }
                    // will match data { }
    return (data, path)=>evalPattern(path, pattern, data);
  },
  $capture(outputKey) { return makeCaptureTest(outputKey);  },
  _$delete(fields) { // double underscore because though it is an elementOp,
              // it operates on the children of the parent
    return function (data) {
      fields.doEach((f)=> delete data[f]);
    };
  },
  _$set(fieldValuePairs) {
    return function (data) {
      for (var k in fieldValuePairs) {
        data[k] = fieldValuePairs[k];
      }
    };
  }
};

export const DEFAULT_AGGREGATORS = {
  _$sorted(key) {
    return function(data) {
      var sortPred;
      if (isFunction(key)) {
        sortPred = key;
      } if (isString(key)) {
        sortPred = function(a, b) {
          if (a[key]<b[key]) {
            return -1;
          } else if (a[key]>b[key]) {
            return 1;
          } else {
            return 0;
          }
        };
      }
      return [...data].sort(sortPred);
    };
  },
  _$capture(outputKey) { return makeCaptureTest(outputKey);  },
  _$count() { return (data)=>data.length; },
  _$max(fields) {
    return function (data, path) {
      var maxes = {};
      data.forEach(function (elt) {
        fields.forEach(function (f) {
          var dval = elt[f];
          var fpath = pathToString([...path, '_$max', f]);
          if (!maxes[fpath] || dval>maxes[fpath]) {
            maxes[fpath] = dval;
          }
        });
      });
      return new Capture(maxes, maxes);
    };
  },
  _$min(fields) {
    return function (data, path) {
      var mins = {};
      data.forEach(function (elt) {
        fields.forEach(function (f) {
          var dval = elt[f];
          var fpath = pathToString([...path, '_$max', f]);
          if (!mins[fpath] || dval<mins[fpath]) {
            mins[fpath] = dval;
          }
        });
      });
      return new Capture(mins, mins);
    };
  },
  _$sum(fields) {
    return function (data, path) {
      var sums = {};

      data.forEach(function (elt) {
        fields.forEach(function (f) {
          var dval = elt[f];
          var fpath = pathToString([...path, '_$sum', f]);
          sums[fpath] = dval + (sums[fpath] || 0);
        });
      });

      return new Capture(sums, sums);
    };
  }
};

const DEFAULT_OPTIONS = {
  ops: DEFAULT_OPERATORS,
  aggregators: DEFAULT_AGGREGATORS,
  first: false
};
