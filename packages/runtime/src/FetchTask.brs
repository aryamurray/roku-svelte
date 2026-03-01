' FetchTask.brs
' @svelte-roku/runtime v0.4
' Task thread implementation for HTTP requests

sub init()
  m.top.functionName = "fetchData"
end sub

sub fetchData()
  request = CreateObject("roUrlTransfer")
  request.setCertificatesFile("common:/certs/ca-bundle.crt")
  request.initClientCertificates()
  request.setUrl(m.top.url)
  if m.top.method = "POST" then
    m.top.response = request.postFromString(m.top.requestBody)
  else
    m.top.response = request.getToString()
  end if
end sub
