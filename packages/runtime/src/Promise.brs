' Promise.brs
' @svelte-roku/runtime v0.4
' Promise state machine — foundation for v0.5 async/await support

function Promise_create() as Object
  return {
    state: "pending",
    value: invalid,
    thenCallbacks: [],
    catchCallbacks: []
  }
end function

sub Promise_resolve(promise as Object, value as Dynamic)
  if promise.state <> "pending" then return
  promise.state = "fulfilled"
  promise.value = value
  for each cb in promise.thenCallbacks
    MicrotaskQueue_enqueue(m._microtaskQueue, cb, value)
  end for
end sub

sub Promise_reject(promise as Object, reason as Dynamic)
  if promise.state <> "pending" then return
  promise.state = "rejected"
  promise.value = reason
  for each cb in promise.catchCallbacks
    MicrotaskQueue_enqueue(m._microtaskQueue, cb, reason)
  end for
end sub

sub Promise_then(promise as Object, callbackName as String)
  if promise.state = "fulfilled" then
    MicrotaskQueue_enqueue(m._microtaskQueue, callbackName, promise.value)
  else if promise.state = "pending" then
    promise.thenCallbacks.push(callbackName)
  end if
end sub
