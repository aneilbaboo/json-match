import {isString, isArray, isNumber, isFunction} from 'util';

import format from 'string-format';

import {evalPattern} from './evaluator';
import {Capture, pathToString, pathIndex, pathParent} from './utils';

// export const DEFAULT_MACROS = {
//   $and(...patterns) {
//     return makeAndTest(patterns);
//   },
//   $or(...patterns) {
//     return;
//   },
//   $if(condition, thenPattern, elsePattern) {
//     return function (data, path) {
//
//     }
//   }
// };

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
//
// function makeAndTest(patterns) {
//
// }
//
// function makeOrTest(patterns) {
// }

export const DEFAULT_OPERATORS = {
  $gt(n) { return (data)=>data>n; },
  $lt(n) { return (data)=>data<n; },
  $gte(n) { return (data)=>data>=n; },
  $lte(n) { return (data)=>data<=n; },
  $isNull() { return (data)=>(data==null); },
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

export const DEFAULT_OPTIONS = {
  ops: DEFAULT_OPERATORS,
  aggregators: DEFAULT_AGGREGATORS,
  //macros: DEFAULT_MACROS,
  first: false
};

// console.log('in OPS... DEFAULT_OPTIONS:%j', Object.keys(DEFAULT_OPERATORS), Object.values(DEFAULT_OPERATORS));
