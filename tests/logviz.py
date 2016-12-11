import json

def calc_header(data):
    src = set([])
    dst = set([])
    clients = set([])
    for rec in data:
        if "cmd" not in rec:
            continue
        src.add(rec["pid"])
        dst.add(rec["aid"])
        clients.add(rec["extra"].split(":")[0])
    return (sorted(list(clients)), sorted(list(src)), sorted(list(dst)))

def print_header(header):
    for xs in header:
        for x in xs:
            print "participant " + x

def collect_responses(data):
    responses = dict()
    for rec in data:
        if "response" in rec:
            responses[rec["id"]] = rec
    return responses

def collect_requests(data):
    requests = []
    for rec in data:
        if "cmd" in rec:
            requests.append(rec)
    return requests

class Request:
    def __init__(self, req):
        self.pid = req["pid"]
        self.aid = req["aid"]
        self.tick = str(req["tick"])
        self.cmd = req["cmd"]
        self.rid = req["id"]
        [client, stage] = req["extra"].split(":")
        self.client = client
        self.stage = "read" if stage == "r" else "write"
        if self.cmd == "accept":
            self.value = str([
                req["state"]["version"],
                req["state"]["value"]
            ])

class PrepareResponse:
    def __init__(self, res):
        self.is_ok = "isPrepared" in res["response"]
        self.is_err = "isConflict" in res["response"]
        self.tick = str(res["response"]["tick"])
        if self.is_ok:
            if res["response"]["state"] == None:
                self.value = "null"
            else:
                self.value = str([
                    res["response"]["state"]["version"],
                    res["response"]["state"]["value"]
                ])

class AcceptResponse:
    def __init__(self, res):
        self.is_ok = "isOk" in res["response"]
        self.is_err = "isConflict" in res["response"]
        if self.is_err:
            self.tick = str(res["response"]["tick"])

class Edge:
    def __init__(self, src, dst, label, client=None, cmd=None):
        self.cmd = cmd
        self.src = src
        self.dst = dst
        self.label = label
        self.client = client
    def render(self):
        arr = "->"
        if self.client == "c2":
            arr = "-->"
        return self.src + arr + self.dst + ": " + self.label

def events(requests, responses):
    log = []
    ticks = dict()
    pids = dict()
    stage = dict()
    for req in requests:
        req = Request(req)
        
        if req.client not in ticks:
            stage[req.client] = req.stage
            log.append(Edge(src=req.client, dst=req.pid, label=req.stage, client=req.client))
        elif ticks[req.client] != req.tick:
            log.append(Edge(src=pids[req.client], dst=req.client, label=stage[req.client], client=req.client))
            stage[req.client] = req.stage
            log.append(Edge(src=req.client, dst=req.pid, label=req.stage, client=req.client)) 
        
        ticks[req.client] = req.tick
        pids[req.client] = req.pid
        
        if req.cmd == "prepare":
            log.append(Edge(src=req.pid, dst=req.aid, label="p " + req.tick, client=req.client))
            res = PrepareResponse(responses[req.rid])
            if res.is_ok:
                log.append(Edge(src=req.aid, dst=req.pid, label="ok " + res.tick + " " + res.value, client=req.client))
            if res.is_err:
                log.append(Edge(src=req.aid, dst=req.pid, label="err " + req.tick, client=req.client))
        if req.cmd == "accept":
            log.append(Edge(src=req.pid, dst=req.aid, label="a " + req.tick + " " + req.value, client=req.client))
            res = AcceptResponse(responses[req.rid])
            if res.is_ok:
                log.append(Edge(src=req.aid, dst=req.pid, label="ok", client=req.client))
            if res.is_err:
                log.append(Edge(src=req.aid, dst=req.pid, label="err " + res.tick, client=req.client))
    return log

def return_control_earlier(edges, header):
    [clients, proposers, acceptors] = header 
    outcome = []
    i = 0
    while i < len(edges):
        edge = edges[i]
        if (edge.src in acceptors) and (edge.dst in proposers):
            j = i + 1
            should_shift = False
            while j < len(edges):
                if edges[j].client != edge.client:
                    j += 1
                    continue
                if (edges[j].src == edge.dst) and (edges[j].dst == edge.client):
                    should_shift = True 
                break
            if should_shift:
                edges[i+1:] = edges[j:j+1] + edges[i+1:j] + edges[j+1:]
            edge = edges[i]
        outcome.append(edge)
        i += 1
    return outcome


data = []

with open("/Users/rystsov/Desktop/Sync/projects/gryadka/tests/_c2p2_shuffling/network.log", "r") as log:
    for line in log:    
        data.append(json.loads(line))

header = calc_header(data)
requests = collect_requests(data)
responses = collect_responses(data)

print_header(header)
#print requests
#print responses
log = events(requests, responses)
log = return_control_earlier(log, header)
for record in log:
    print record.render();
#edges(requests, responses)


# (id, "prepare", tick, client, pid, aid)
#    if self.state[client].tick == null:
#      print client + "->" + pid + ": " + stage
#    elsif self.state[client].tick != tick:
#      print pid + "->" + client + ": "
#      print client + "->" + pid + ": " + stage
#    self.state[client].tick = tick
#    print pid + "->" + aid + ": " + "p " + tick
#    if self.response[id].is_ok:
#      print aid + "->" + pid + ": ok " + self.response[id].tick + " " + self.response[id].value
#    else:
#      print aid + "->" + pid + ": err " + self.response[id].tick

# (id, "accept", tick, client, pid, aid, value)
#    if self.state[client].tick == null:
#      raise new Exception()
#    elsif self.state[client].tick != tick:
#      print pid + "->" + client + ": "
#      print client + "->" + pid + ": " + stage
#    self.state[client].tick = tick
#    print pid + "->" + aid + ":" + " a " + tick + " " + value
#    if self.response[id].is_ok:
#      print aid + "->" + pid + ": ok "
#    else:
#      print aid + "->" + pid + ": err" + self.response[id].tick
