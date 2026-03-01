' Stdlib.brs — svelte-roku runtime standard library helpers
' Generated runtime helpers for JavaScript stdlib transpilation

' === Type disambiguation ===

function SvelteRoku_length(val as Dynamic) as Integer
  if type(val) = "roArray" then return val.Count()
  if type(val) = "String" or type(val) = "roString" then return Len(val)
  return 0
end function

function SvelteRoku_iif(cond as Boolean, trueVal as Dynamic, falseVal as Dynamic) as Dynamic
  if cond then return trueVal
  return falseVal
end function

' === Array helpers ===

function SvelteRoku_arrayIncludes(arr as Object, val as Dynamic) as Boolean
  for each item in arr
    if item = val then return true
  end for
  return false
end function

function SvelteRoku_arrayIndexOf(arr as Object, val as Dynamic) as Integer
  i = 0
  for each item in arr
    if item = val then return i
    i = i + 1
  end for
  return -1
end function

function SvelteRoku_arraySlice(arr as Object, startIdx as Integer, endIdx = invalid as Dynamic) as Object
  result = []
  len = arr.Count()
  s = startIdx
  if s < 0 then s = len + s
  if s < 0 then s = 0
  if endIdx = invalid then
    e = len
  else
    e = endIdx
    if e < 0 then e = len + e
  end if
  if e > len then e = len
  for i = s to e - 1
    result.Push(arr[i])
  end for
  return result
end function

function SvelteRoku_arraySplice(arr as Object, startIdx as Integer, deleteCount as Integer) as Object
  result = []
  len = arr.Count()
  s = startIdx
  if s < 0 then s = len + s
  if s < 0 then s = 0
  removed = []
  for i = 0 to deleteCount - 1
    if s < arr.Count() then
      removed.Push(arr[s])
      arr.Delete(s)
    end if
  end for
  return removed
end function

function SvelteRoku_arrayFlat(arr as Object) as Object
  result = []
  for each item in arr
    if type(item) = "roArray" then
      for each subItem in item
        result.Push(subItem)
      end for
    else
      result.Push(item)
    end if
  end for
  return result
end function

function SvelteRoku_arrayFill(arr as Object, val as Dynamic) as Object
  for i = 0 to arr.Count() - 1
    arr[i] = val
  end for
  return arr
end function

function SvelteRoku_arrayJoin(arr as Object, sep = "," as String) as String
  result = ""
  for i = 0 to arr.Count() - 1
    if i > 0 then result = result + sep
    item = arr[i]
    if type(item) = "Integer" or type(item) = "Float" or type(item) = "Double" then
      tmp = Str(item)
      result = result + tmp.Trim()
    else if type(item) = "Boolean" then
      if item then result = result + "true" else result = result + "false"
    else if type(item) = "String" or type(item) = "roString" then
      result = result + item
    end if
  end for
  return result
end function

function SvelteRoku_arrayFrom(val as Dynamic) as Object
  if type(val) = "roArray" then return val
  result = []
  if type(val) = "String" or type(val) = "roString" then
    for i = 1 to Len(val)
      result.Push(Mid(val, i, 1))
    end for
  end if
  return result
end function

function SvelteRoku_arrayIsArray(val as Dynamic) as Boolean
  return type(val) = "roArray"
end function

' === String helpers ===

function SvelteRoku_strLastIndexOf(s as String, searchStr as String) as Integer
  result = -1
  p = 1
  while p <= Len(s)
    found = Instr(p, s, searchStr)
    if found = 0 then exit while
    result = found - 1
    p = found + 1
  end while
  return result
end function

function SvelteRoku_strSlice(s as String, startIdx as Integer, endIdx = invalid as Dynamic) as String
  sLen = Len(s)
  st = startIdx
  if st < 0 then st = sLen + st
  if st < 0 then st = 0
  if endIdx = invalid then
    e = sLen
  else
    e = endIdx
    if e < 0 then e = sLen + e
  end if
  if e > sLen then e = sLen
  if st >= e then return ""
  return Mid(s, st + 1, e - st)
end function

function SvelteRoku_strSubstring(s as String, startIdx as Integer, endIdx = invalid as Dynamic) as String
  sLen = Len(s)
  st = startIdx
  if st < 0 then st = 0
  if endIdx = invalid then
    e = sLen
  else
    e = endIdx
    if e < 0 then e = 0
  end if
  if st > e then
    tmp = st
    st = e
    e = tmp
  end if
  if e > sLen then e = sLen
  return Mid(s, st + 1, e - st)
end function

function SvelteRoku_strSubstr(s as String, startIdx as Integer, length = invalid as Dynamic) as String
  sLen = Len(s)
  st = startIdx
  if st < 0 then st = sLen + st
  if st < 0 then st = 0
  if length = invalid then
    l = sLen - st
  else
    l = length
  end if
  if l < 0 then l = 0
  return Mid(s, st + 1, l)
end function

function SvelteRoku_strReplaceAll(s as String, search as String, replacement as String) as String
  result = s
  p = 1
  while p <= Len(result)
    found = Instr(p, result, search)
    if found = 0 then exit while
    result = Left(result, found - 1) + replacement + Mid(result, found + Len(search))
    p = found + Len(replacement)
  end while
  return result
end function

function SvelteRoku_strTrimStart(s as String) as String
  i = 1
  while i <= Len(s) and (Mid(s, i, 1) = " " or Mid(s, i, 1) = Chr(9) or Mid(s, i, 1) = Chr(10) or Mid(s, i, 1) = Chr(13))
    i = i + 1
  end while
  return Mid(s, i)
end function

function SvelteRoku_strTrimEnd(s as String) as String
  i = Len(s)
  while i > 0 and (Mid(s, i, 1) = " " or Mid(s, i, 1) = Chr(9) or Mid(s, i, 1) = Chr(10) or Mid(s, i, 1) = Chr(13))
    i = i - 1
  end while
  return Left(s, i)
end function

function SvelteRoku_strPadStart(s as String, targetLen as Integer, padStr = " " as String) as String
  result = s
  while Len(result) < targetLen
    result = padStr + result
  end while
  return Right(result, targetLen)
end function

function SvelteRoku_strPadEnd(s as String, targetLen as Integer, padStr = " " as String) as String
  result = s
  while Len(result) < targetLen
    result = result + padStr
  end while
  return Left(result, targetLen)
end function

function SvelteRoku_strRepeat(s as String, count as Integer) as String
  result = ""
  for i = 1 to count
    result = result + s
  end for
  return result
end function

' === Math helpers ===

function SvelteRoku_mathCeil(x as Float) as Integer
  i = Int(x)
  if x > i then return i + 1
  return i
end function

function SvelteRoku_mathMin(a as Dynamic, b as Dynamic) as Dynamic
  if a < b then return a
  return b
end function

function SvelteRoku_mathMax(a as Dynamic, b as Dynamic) as Dynamic
  if a > b then return a
  return b
end function

function SvelteRoku_mathSign(x as Dynamic) as Integer
  if x > 0 then return 1
  if x < 0 then return -1
  return 0
end function

function SvelteRoku_mathTrunc(x as Float) as Integer
  if x >= 0 then return Int(x)
  return -Int(-x)
end function

function SvelteRoku_mathClamp(x as Dynamic, minVal as Dynamic, maxVal as Dynamic) as Dynamic
  if x < minVal then return minVal
  if x > maxVal then return maxVal
  return x
end function

' === Object helpers ===

function SvelteRoku_objectValues(obj as Object) as Object
  result = []
  for each key in obj.Keys()
    result.Push(obj[key])
  end for
  return result
end function

function SvelteRoku_objectEntries(obj as Object) as Object
  result = []
  for each key in obj.Keys()
    result.Push([key, obj[key]])
  end for
  return result
end function

function SvelteRoku_objectFromEntries(entries as Object) as Object
  result = {}
  for each entry in entries
    if type(entry) = "roArray" and entry.Count() >= 2 then
      result[entry[0]] = entry[1]
    end if
  end for
  return result
end function
