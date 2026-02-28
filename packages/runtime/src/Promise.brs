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

function Promise_resolve(promise as Object, value as Dynamic) as Void
  if promise.state <> "pending" then return
  promise.state = "fulfilled"
  promise.value = value
  for each cb in promise.thenCallbacks
    MicrotaskQueue_enqueue(m._microtaskQueue, cb, value)
  end for
end function

function Promise_reject(promise as Object, reason as Dynamic) as Void
  if promise.state <> "pending" then return
  promise.state = "rejected"
  promise.value = reason
  for each cb in promise.catchCallbacks
    MicrotaskQueue_enqueue(m._microtaskQueue, cb, reason)
  end for
end function

function Promise_then(promise as Object, callbackName as String) as Void
  if promise.state = "fulfilled" then
    MicrotaskQueue_enqueue(m._microtaskQueue, callbackName, promise.value)
  else if promise.state = "pending" then
    promise.thenCallbacks.push(callbackName)
  end if
end function
