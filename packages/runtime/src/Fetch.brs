' Fetch.brs
' @svelte-roku/runtime v0.4
' Runtime fetch() function wrapping roUrlTransfer via Task node

function fetch(url as String, options = {} as Object) as Object
  taskNode = CreateObject("roSGNode", "SvelteRoku_FetchTask")
  taskNode.url = url
  if options.method <> invalid then taskNode.method = options.method
  if options.body <> invalid then taskNode.requestBody = options.body
  taskNode.control = "RUN"
  return taskNode
end function
