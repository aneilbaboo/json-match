import {isString, isArray} from 'util';//
// Results returned from tests
//
export function Capture(value, captures) {
  this.value = value;
  this.bindings = captures;
}

export function isCapture(o) {
  return o && o.constructor==Capture;
}

export function isSuccess(v) {
  return (v || v===0);
}

// export function addResult(r1, r2) {
//   if (isSuccess(r2)) {
//     if (isResult(r2)) {
//       r1.value = r2.value;
//       Object.assign(r1.bindings, r2.bindings);
//       return r1;
//     } else {
//       r1.value = r2;
//       return r1;
//     }
//   }
// }

export function check(test, msg, ...args) {
  if (!test) {
    throw new Error(msg, ...args);
  }
}

export function pathToArray(path) { return isString(path) ? path.split('.') : path; }
export function pathToString(path) { return isArray(path) ? path.join('.') : path; }
export function pathIndex(path) { return path[path.length -1]; }
export function pathParent(path) { return path.slice(0, path.length -1); }
export function setPath(obj, path, value) {
  path = pathToArray(path);
  var [head, ...tail] = path;
  if (tail.length==0) {
    obj[head] = value;
  } else {
    var nextObj = obj[head];
    if (!nextObj) {
      nextObj = obj[head] = {};
    }
    setPath(nextObj, tail, value);
  }
}


/**
 * getPath - gets the value of obj at path
 *
 * @param  {Object} obj
 * @param  {(String|Array)} path array of fields or a string with dot-separate fields
 * @return {*}      Value at path in obj
 */
export function getPath(obj, path) {
  path = pathToArray(path);
  var [head, ...tail] = path;
  if (obj && head) {
    return getPath(obj[head], tail);
  } else {
    return obj;
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
