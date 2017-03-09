# json-match

Match, extract and modify JSON using patterns described with JSON.

## Install
```shell
npm install json-match
```

## API
```
var match = require('json-match').match;
```

### match
`match(pattern, data)` - Returns null on failure or a hash of captured values

```javascript
// deep match data (key order ignored)
match({a:1, b:{c:2, d:{e: 3}}}, {a:1, b:{d:{e: 3}, c:2}}); // => {} success

// null = failure
match({a:"will not match"}, {b:2}); // => null

// operators
match({a:{$regex("hello.*")}, b:{$lt:3}},
      {a: "hello there!", b: 4}); // => {} success

// capture bindings
match({ a:1,
        b: { c: {$lt: 5, $capture:true}, // use the path as the key
             d: {$capture: "dvalue"}}},  // provide your own key
      { a:1, b: {c: 4, d: 4}}); // => {"a.b.c": 3, "dvalue": 4}      


// operator arguments:  { $op: arg }
// * if arg is an Object, it is a pattern that is matched against the result of $op
// e.g.,
match({b:{  $isNumber: {$capture: "isNumberResult"},
            $capture:"bvalue" }},
      {b:3}}); // => {"bvalue":3, "isNumberResult":true}


// * if arg is an Array, the values are matched against the parent value and passed
//   to the operator
match({b: {$or: [$lt:10, $gt:100]}, {b:0}}); // => {} success
match({b: {$or: [$lt:10, $gt:100]}, {b:50}}); // => null fail
match({b: {$or: [$lt:10, $gt:100]}, {b:101}}); // => {} success


// compare object argument to array argument:
// the pattern match value of b is the result of $isNumber, so this fails:
match({b:{$isNumber: {$not: true}}}, {b: "not number"}); // => null
// $not: true test the result of $isNumber, but since $isNumber returns false,
// the pattern for b fails

// but here, isNumber is applied to the value of b, then passed to $not
match({b: {$not: [{$isNumber:true}]}, {b:"not a number"}}); // => success

// a short cut for applying not to boolean arguments is to pass
// false instead of true:
match({b:{$isNumber:false}}, {b: "not number"}); // => {} success

// $capture: capture matching items in an array to separate bindings
match({array:{ a:1, b:2, $capture:true }},
      {array: [{z:1}, {a:1, b:2}, {a:1, b:2, c:3}]});
      // => {"array.1": {a:1, b:2}, "array.2":{a:1, b:2, c:3}}

// $capture: capture matching items in an array to separate custom-named bindings
match({array:{ a:1, b:2, $capture:"result{index}" }},
  {array: [{z:1}, {a:1, b:2}, {a:1, b:2, c:3}]});
  // => {"result1": {a:1, b:2}, "result2":{a:1, b:2, c:3}}
match({array:{ a:1, b:2, $capture:"r:{parent}:{index}" }},
  {array: [{z:1}, {a:1, b:2}, {a:1, b:2, c:3}]});
  // => {"r:array:1": {a:1, b:2}, "r:array:2":{a:1, b:2, c:3}}

// _{operator} = aggregate operation on the whole list
// _$capture: capture all matched items into a binding
match({array:{ a:1, b:2, _$capture:true }},
      {array: [{z:1}, {a:1, b:2}, {a:1, b:2, c:3}]});
      // => {"array": [{a:1, b:2}, {a:1, b:2, c:3}]}

match({array:{ a:1, b:2, _$count:true, }},
      {array: [{z:1}, {a:1, b:2}, {a:1, b:2, c:3}]});
      // => {"array.1": {a:1, b:2}}

// is any non-null value provided?
match({b:{$any:true}}, {b: null}); // => null false
match({b:{$any:true}}, {b: undefined}); // => null fail      
match({b:{$any:true}}, {b: 1}); // => {} success
match({b:{$any:true}}, {b: 0}); // => {} success

// truthy?
match({b:{$true:true}}, {b: null}); // => null false
match({b:{$true:true}}, {b: undefined}); // => null fail
match({b:{$true:true}}, {b: 1}); // => {} success
match({b:{$true:true}}, {b: 0}); // => null fail

// is the key present, even if the value is null?
match({b:{$defined:true}}, {b: null}); // => {} success

match({b:{$defined:true}}, {}); // => null
```

#### match options

##### first
For each array, stops matching after the first match in an array. Default is false.
This can be overriden for a particular element using the special $first operator.

##### ops
A hash of custom operators. Operators take arguments and return a test. A test
takes (data, path), where data is the value of the key in the data, and path
is an array describing the path to the key.  This replaces the default operators
provided in `DEFAULT_OPERATORS`.

Tests indicate success by returning any value which is not `undefined` or `null`.
```javascript
match({b: {$isHello:true}}, {b:"hello"},
      {ops: {$isHello() { return (data)=>data=="hello"; }}}); // {}
```

```javascript
match({b: {$ifGreetingCapture:true}}, {b:"hi"},
      {
        ops: {
          $ifGreetingCapture(data, path) {

          }
        }
      }
    );
```
Tests indicate captured values by returning a Capture instance, which takes the
returned value and a hash of captured values.

##### aggregators
A hash of operators which will be applied to the result of processing an Array.
This replaces the default aggregators provided in `DEFAULT_AGGREGATORS`.

##### alias
A hash which maps operators to other names.  

### getPath
```javascript
import {getPath} from 'json-path';
getPath({a:{b:{c:"hello"}}}, "a.b.c"); // => hello
getPath({a:{b:{c:"hello"}}}, ["a", "b", "c"]); // => hello
```

### pathToString
```javascript
import {pathToString} from 'json-path';
pathToString(["a", "b", "c"]); // => "a.b.c"); /
```

### pathToArray
```javascript
import {pathToArray} from 'json-path';
pathToArray("a.b.c"); // => ["a", "b", "c"]
```

# Design Goals

The overarching goal is to provide a way to match (and modify) JSON documents with
a query which is transparent, familiar, simple and easy to introspect.

* encode query, including query operators, as pure JSON
* shape the query like the data
* capture and modify arbitrary parts of the JSON document
* combine matching operations

Because the query is shaped like the data, it can easily be inspected and modified
before processing.  These properties make it particularly useful in the context
of APIs.  Users of the API can use familiar JSON to describe the shape of the objects
they wish to match.  Developers can validate and modify the query before submitting
it for matching. For example, the developer could ensure that particular values of
the tree are queried or captured, or disallowing particular operators on some
elements of the document.  

One downside of the approach is that operator keys could collide with data keys.
An `alias` option is provided as a work around.

## Comparison to other projects

### Query languages

#### JSON query

The project most similar in spirit is [json-filter](https://github.com/mmckegg/json-filter).


#### Custom syntaxes
These projects provide means for querying values from JSON documents, and may offer
the ability to modify. Some provide custom syntaxes for expressing queries.  

* [lodash-pattern-match](https://github.com/Originate/lodash-match-pattern)
* [jsonquerylanguage](https://github.com/adplabs/JQL)
* [json-query](https://github.com/mmckegg/json-query )

#### Query using functions
* [match](https://github.com/ozkxr/match)
* [pattern-match](https://github.com/dherman/pattern-match)

### Validation

These projects are intended to validate JSON schemas, but not retrieve values or
modify the JSON document.

* [json-matchers](https://github.com/thoughtbot/json_matchers)
* [json-schema](https://www.npmjs.com/package/jsonschema) based on IETF spec
* [joi](https://github.com/hapijs/joi) An excellent JSON schema validation package used in the HAPI web framework and other libraries
