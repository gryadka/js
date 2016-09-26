local promise   = KEYS[1] .. '/promise'
local ballot    = KEYS[1] .. '/ballot'
local value     = KEYS[1] .. '/value'

local function parse_tick (txt_tick)
  local i = 0
  local tick = {}
  for x in string.gmatch(txt_tick, "%d+") do
    tick[i] = tonumber(x)
    i = i + 1
  end
  return tick
end

local function cmp_tick (ticka, tickb)
  for i=0,2,1 do
    if ticka[i] < tickb[i] then return -1 end
    if tickb[i] < ticka[i] then return 1 end
  end
  return 0;
end

if redis.call('EXISTS', promise) == 0 then
  redis.call('SET', promise, "0,0,0")
  redis.call('SET', ballot, "0,0,0")
  redis.call('SET', value, "")
end

local promised = redis.call('GET', promise) 
if cmp_tick(parse_tick(promised), parse_tick(KEYS[2])) <= 0 then
  redis.call('SET', promise, KEYS[2])
  redis.call('SET', ballot, KEYS[2])
  redis.call('SET', value, KEYS[3])
  return {'ok'}
end
return {'fail', promised}