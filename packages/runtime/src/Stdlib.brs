' Stdlib.brs — svelte-roku runtime standard library helpers
' Generated runtime helpers for JavaScript stdlib transpilation

' === Type disambiguation ===

function SvelteRoku_length(val)
  if type(val) = "roArray" then return val.Count()
  if type(val) = "String" or type(val) = "roString" then return Len(val)
  return 0
end function

function SvelteRoku_iif(cond, trueVal, falseVal)
  if cond then return trueVal
  return falseVal
end function

' === Array helpers ===

function SvelteRoku_arrayIncludes(arr, val)
  for each item in arr
    if item = val then return true
  end for
  return false
end function

function SvelteRoku_arrayIndexOf(arr, val)
  i = 0
  for each item in arr
    if item = val then return i
    i = i + 1
  end for
  return -1
end function

function SvelteRoku_arraySlice(arr, startIdx, endIdx = invalid)
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

function SvelteRoku_arraySplice(arr, startIdx, deleteCount)
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

function SvelteRoku_arrayFlat(arr)
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

function SvelteRoku_arrayFill(arr, val)
  for i = 0 to arr.Count() - 1
    arr[i] = val
  end for
  return arr
end function

function SvelteRoku_arrayJoin(arr, sep = ",")
  result = ""
  for i = 0 to arr.Count() - 1
    if i > 0 then result = result + sep
    item = arr[i]
    if type(item) = "Integer" or type(item) = "Float" or type(item) = "Double" then
      result = result + Str(item).Trim()
    else if type(item) = "Boolean" then
      if item then result = result + "true" else result = result + "false"
    else
      result = result + Str(item)
    end if
  end for
  return result
end function

function SvelteRoku_arrayFrom(val)
  if type(val) = "roArray" then return val
  result = []
  if type(val) = "String" or type(val) = "roString" then
    for i = 1 to Len(val)
      result.Push(Mid(val, i, 1))
    end for
  end if
  return result
end function

function SvelteRoku_arrayIsArray(val)
  return type(val) = "roArray"
end function

' === String helpers ===

function SvelteRoku_strLastIndexOf(str, sub)
  result = -1
  pos = 1
  while pos <= Len(str)
    found = Instr(pos, str, sub)
    if found = 0 then exit while
    result = found - 1
    pos = found + 1
  end while
  return result
end function

function SvelteRoku_strSlice(str, startIdx, endIdx = invalid)
  len = Len(str)
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
  if s >= e then return ""
  return Mid(str, s + 1, e - s)
end function

function SvelteRoku_strSubstring(str, startIdx, endIdx = invalid)
  len = Len(str)
  s = startIdx
  if s < 0 then s = 0
  if endIdx = invalid then
    e = len
  else
    e = endIdx
    if e < 0 then e = 0
  end if
  if s > e then
    tmp = s
    s = e
    e = tmp
  end if
  if e > len then e = len
  return Mid(str, s + 1, e - s)
end function

function SvelteRoku_strSubstr(str, startIdx, length = invalid)
  len = Len(str)
  s = startIdx
  if s < 0 then s = len + s
  if s < 0 then s = 0
  if length = invalid then
    l = len - s
  else
    l = length
  end if
  if l < 0 then l = 0
  return Mid(str, s + 1, l)
end function

function SvelteRoku_strReplaceAll(str, search, replacement)
  result = str
  pos = 1
  while pos <= Len(result)
    found = Instr(pos, result, search)
    if found = 0 then exit while
    result = Left(result, found - 1) + replacement + Mid(result, found + Len(search))
    pos = found + Len(replacement)
  end while
  return result
end function

function SvelteRoku_strTrimStart(str)
  i = 1
  while i <= Len(str) and (Mid(str, i, 1) = " " or Mid(str, i, 1) = Chr(9) or Mid(str, i, 1) = Chr(10) or Mid(str, i, 1) = Chr(13))
    i = i + 1
  end while
  return Mid(str, i)
end function

function SvelteRoku_strTrimEnd(str)
  i = Len(str)
  while i > 0 and (Mid(str, i, 1) = " " or Mid(str, i, 1) = Chr(9) or Mid(str, i, 1) = Chr(10) or Mid(str, i, 1) = Chr(13))
    i = i - 1
  end while
  return Left(str, i)
end function

function SvelteRoku_strPadStart(str, targetLen, padStr = " ")
  result = str
  while Len(result) < targetLen
    result = padStr + result
  end while
  return Right(result, targetLen)
end function

function SvelteRoku_strPadEnd(str, targetLen, padStr = " ")
  result = str
  while Len(result) < targetLen
    result = result + padStr
  end while
  return Left(result, targetLen)
end function

function SvelteRoku_strRepeat(str, count)
  result = ""
  for i = 1 to count
    result = result + str
  end for
  return result
end function

' === Math helpers ===

function SvelteRoku_mathCeil(x)
  i = Int(x)
  if x > i then return i + 1
  return i
end function

function SvelteRoku_mathMin(a, b)
  if a < b then return a
  return b
end function

function SvelteRoku_mathMax(a, b)
  if a > b then return a
  return b
end function

function SvelteRoku_mathSign(x)
  if x > 0 then return 1
  if x < 0 then return -1
  return 0
end function

function SvelteRoku_mathTrunc(x)
  if x >= 0 then return Int(x)
  return -Int(-x)
end function

function SvelteRoku_mathClamp(x, minVal, maxVal)
  if x < minVal then return minVal
  if x > maxVal then return maxVal
  return x
end function

' === Object helpers ===

function SvelteRoku_objectValues(obj)
  result = []
  for each key in obj.Keys()
    result.Push(obj[key])
  end for
  return result
end function

function SvelteRoku_objectEntries(obj)
  result = []
  for each key in obj.Keys()
    result.Push([key, obj[key]])
  end for
  return result
end function

function SvelteRoku_objectFromEntries(entries)
  result = {}
  for each entry in entries
    if type(entry) = "roArray" and entry.Count() >= 2 then
      result[entry[0]] = entry[1]
    end if
  end for
  return result
end function
