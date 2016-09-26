local key = KEYS[1]
local eon = KEYS[2]

if redis.call('EXISTS', key) == 0 then
  redis.call('SET', key, eon)
end

local saved = redis.call('GET', key) 
if saved < eon then
  redis.call('SET', key, eon)
  return eon
end
return saved
