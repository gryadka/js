local promised_ballot_key = KEYS[1] .. '/promise'
local accepted_ballot_key = KEYS[1] .. '/ballot'
local accepted_value_key  = KEYS[1] .. '/value'

local function parse_ballot (txt_ballot)
  local counter, id = txt_ballot:match("([^,]+),([^,]*)")
  local ballot = {}
  ballot[0] = tonumber(counter)
  ballot[1] = id
  return ballot
end

local function cmp_ballots (ballot_a, ballot_b)
  if ballot_a[0] < ballot_b[0] then return -1 end
  if ballot_b[0] < ballot_a[0] then return 1 end
  if ballot_a[1] < ballot_b[1] then return -1 end
  if ballot_b[1] < ballot_a[1] then return 1 end
  return 0
end

if redis.call('EXISTS', promised_ballot_key) == 0 then
  redis.call('SET', promised_ballot_key, "0,")
  redis.call('SET', accepted_ballot_key, "0,")
  redis.call('SET', accepted_value_key, "")
end

local promised_ballot = parse_ballot(redis.call('GET', promised_ballot_key))
local accepted_ballot = parse_ballot(redis.call('GET', accepted_ballot_key))
local candidate = parse_ballot(KEYS[2])
local promise = parse_ballot(KEYS[4])

if cmp_ballots(candidate, promised_ballot) < 0 then
  return {'fail', tostring(promised_ballot[0]) .. "," .. promised_ballot[1] }
end

if cmp_ballots(candidate, accepted_ballot) <= 0 then
  return {'fail', tostring(accepted_ballot[0]) .. "," .. accepted_ballot[1] }
end

redis.call('SET', promised_ballot_key, KEYS[4])
redis.call('SET', accepted_ballot_key, KEYS[2])
redis.call('SET', accepted_value_key, KEYS[3])
return {'ok'}