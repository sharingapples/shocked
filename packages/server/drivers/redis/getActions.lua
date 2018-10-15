-- A script to retreive actions falling with the given range
-- without being changed. Used with redis channel driver
-- used with shocked tracker
local serialNum = tonumber(ARGV[1])
local serialKey = KEYS[1]
local actionsKey = KEYS[2]

local serial = tonumber(redis.call('get', serialKey))
if serial == nil then serial = 0 end

local length = redis.call('llen', actionsKey)
if length == nil then length = 0 end

if serialNum > serial then return {serial} end

local diff = serial - serialNum

if diff > length then return {serial} end

return {serial, redis.call('lrange', actionsKey, length - diff, -1)}
