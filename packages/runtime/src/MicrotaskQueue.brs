' MicrotaskQueue.brs
' @svelte-roku/runtime v0.4
' Event loop glue — foundation for v0.5 async/await support

function MicrotaskQueue_create() as Object
  return {
    tasks: []
  }
end function

sub MicrotaskQueue_enqueue(queue as Object, callbackName as String, data as Dynamic)
  queue.tasks.push({
    callbackName: callbackName,
    data: data
  })
end sub

sub MicrotaskQueue_flush(queue as Object)
  while queue.tasks.count() > 0
    task = queue.tasks.shift()
    m[task.callbackName](task.data)
  end while
end sub
