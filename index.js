$("#char-name-field").keypress(function(event){
    var keycode = (event.keyCode ? event.keyCode : event.which);
    if(keycode == '13'){
        updateChar($("#char-name-field").val());
    }
});

function updateChar(name)
{
    $("#empty-kb").css("display", "none");
    $("#middle-column, #right-column").css("display", "block");
    $("#right-column-friends").css("display", "none");
    $("#right-column-loading").css("display", "block");
    $(".card-body").css("display", "none");
    $("#card-body-loading").css("display", "block");
    $("#info").css("display", "none");
    $("#info-loading").css("display", "block");

    function processChar(char_id)
    {
        $("#char-portrait").attr("src", `https://imageserver.eveonline.com/Character/${char_id}_256.jpg`);
        getBasicInfo(char_id);
        isKillboardEmpty(char_id).then((value) => {
            if(value == true)
            {
                $("#middle-column").css("display", "none");
                $("#right-column").css("display", "none");
                $("#empty-kb").css("display", "block");
            }
            else
            {
                var promises = [];
                promises.push(checkLosses(char_id), checkKills(char_id));
                Promise.all(promises).then(() => {
                    $("#empty-kb, #info-loading").css("display", "none");
                    $("#middle-column, #info, #right-column").css("display", "block");
                });
            }
        });
    }

    if($("#strict_checkbox").is(":checked"))
    {
        getCharIDStrict(name).then((char_id) => {
            processChar(char_id);
        });
    }
    else
    {
        getCharID(name).then((char_id) => {
            processChar(char_id);
        });
    }
}

function getBasicInfo(char_id)
{
    $.getJSON(`https://esi.evetech.net/latest/characters/${char_id}/`, function(char_data){

        $("#char-name, #alliance, #corporation, #sec-status, #birth").empty();

        $("#char-name").html(`<a target="_blank" href="https://zkillboard.com/character/${char_id}/">${char_data.name}</a>`);

        if(char_data.alliance_id != undefined)
        {
            $.getJSON(`https://esi.evetech.net/latest/alliances/${char_data.alliance_id}/`, function(data){
            $("#alliance").html(`<a target="_blank" href="https://zkillboard.com/alliance/${char_data.alliance_id}/">${data.name}</a> &lt;${data.ticker}&gt;`);
        });
        }
        $.getJSON(`https://esi.evetech.net/latest/corporations/${char_data.corporation_id}/`, function(data){
            $("#corporation").html(`<a target="_blank" href="https://zkillboard.com/corporation/${char_data.corporation_id}/">${data.name}</a> [${data.ticker}]`);
        });

        var sec_stat_class;
        if(parseFloat(char_data.security_status) > 2.5)
        {
            sec_stat_class = "sec-status-krab";
        }
        else if(parseFloat(char_data.security_status) < -1.0)
        {
            sec_stat_class = "sec-status-pvp";
        }
        else
        {
            sec_stat_class = "sec-status-neutral";
        }
        $("#sec-status").html(`Security status: <span class="${sec_stat_class}">${(char_data.security_status).toFixed(2)}</span>`);

        $("#birth").html(`<a target="_blank" href="https://evewho.com/pilot/${encodeURI(char_data.name)}">${moment(char_data.birthday).format('YYYY')} character</a>`);

        $(".card-body").css("display", "block");
        $("#card-body-loading").css("display", "none");
    });
}

function checkLosses(char_id)
{
    return new Promise((resolve) => {
        $.ajax({
            cache: true,
            url: `https://zkillboard.com/api/losses/characterID/${char_id}/`,
            dataType: "json",
            }).done((data) => {
                $("#cyno-list").empty();
                $("#lossmails-checked").text(`${data.length} lossmails`);

                formCynoLossesList(data).then((value) => {
                    updateCynoLossesList(value);
                    resolve();
                });
            });
    });
}

function checkKills(char_id)
{
    return new Promise((resolve) => {
        $.ajax({
            cache: true,
            url: `https://zkillboard.com/api/kills/characterID/${char_id}/`,
            dataType: "json",
        }).done((data) => {
            $("#friends>ul").empty();
            $("#super-list").empty();
            $("#killmails-checked").text(`${data.length} killmails`);

            formFriendsList(data, char_id).then((value) => {updateFriendsList(value);});

            formSupersKillsList(data).then((value) => {updateSupersKillsList(value);});
            
            getAndUpdateMostUsedShips(data, char_id).then(() => {resolve();});
        });
    });
}

function getAndUpdateMostUsedShips(data, char_id)
{
    return new Promise((resolve) => {
        var used_ships = [];
        data.forEach(function(killmail){
            var char_on_killmail = killmail.attackers.find(attacker => attacker.character_id == char_id);
            if("ship_type_id" in char_on_killmail)
            {
                var ship_used_on_this_killmail = char_on_killmail.ship_type_id;
                if(used_ships.find(x => x.id == ship_used_on_this_killmail) == undefined)
                {
                    used_ships.push({id: ship_used_on_this_killmail, kills: 1});
                }
                else
                {
                    used_ships.find(x => x.id == ship_used_on_this_killmail).kills += 1;
                }
            }
        });
        sortShipsByMostUsed(used_ships);
        updateMostUsedShips(used_ships, char_id);
        resolve();
    });
}

function sortShipsByMostUsed(ships)
{
    return ships.sort(function(a,b){
        return b.kills - a.kills;
    });
}

function updateMostUsedShips(ships, char_id)
{
    for (let index = 0; index < 3; index++) {
        $(`#${index}-most-used`).css("display", "none");
        if(!(ships[index] === undefined))
        {
            $(`#${index}-most-used-preview`).attr("src", `https://imageserver.eveonline.com/Render/${ships[index].id}_128.png`);	
            $(`#${index}-most-used-amount`).text(`(${ships[index].kills} kills)`);
            getShipName(ships[index].id, function(ship_name){
                $(`#${index}-most-used-text`).text(ship_name);
                $(`#${index}-most-used-link`).attr("href", `https://zkillboard.com/character/${char_id}/losses/shipID/${ships[index].id}/`);
                $(`#${index}-most-used`).css("display", "block");
            });
        }
    }
}

function getCharID(char_name)
{
    return new Promise((resolve) => {
        $.getJSON(`https://esi.evetech.net/latest/search/?categories=character&datasource=tranquility&search=${encodeURI(char_name)}&strict=true`).then((data) => {
            resolve(data.character[0]);
        });
    });
}

function getCharIDStrict(char_name)
{
    return new Promise((resolve) => {
        $.getJSON(`https://esi.evetech.net/latest/search/?categories=character&datasource=tranquility&search=${encodeURI(char_name)}&strict=true`).then((data) => {
            resolve(checkAllNames(char_name, data));
        }).then((char_id) => {
            resolve(char_id);
        });
    });
}

function checkAllNames(char_name, data)
{
    var promises = [];
    var correct_char;

    data.character.forEach((element) => {
        promises.push(new Promise((resolve) => {
            $.getJSON(`https://esi.evetech.net/latest/characters/${element}/`).then((char_data) => {
                if(char_name === char_data.name)
                {
                    correct_char = element;
                }
                resolve();
            });
        }));
    });

    return Promise.all(promises).then(() => {
        return correct_char;
    });
}

function getShipName(ship_id, callback)
{
    $.getJSON(`https://esi.evetech.net/latest/universe/types/${ship_id}/`, function(data){
        callback(data.name);
    });
}

function getPercent(number, total)
{
    var percent = Math.round(number/total*100, 1);
    if(isNaN(percent))
    {
        return 0;
    }
    else
    {
        return percent;
    }
}

function isKillboardEmpty(char_id)
{
    return new Promise((resolve) => {
        $.getJSON(`https://zkillboard.com/api/stats/characterID/${char_id}/`).then(function(data){
        resolve((data.shipsDestroyed === undefined) && (data.shipsLost === undefined));
        });
    });
}

function updateFriendsList(html)
{
    $("#friends>ul").append(html);
    tinysort("#friends>ul>li", {order: 'desc', selector: 'a', data: 'number'});
}

function formFriendsList(data, char_id)
{
    var promises = [];
    var friends_list_html = "";
    var number_of_killmails = data.length;

    var alliances = formAlliancesList(data);

    alliances.forEach(function(alliance_id){
        if(alliance_id != undefined)
        {
            var alliance_on_killmails = 0;
            data.forEach(function(killmail){
                if(killmail.attackers.some(x => x.alliance_id == alliance_id && x.character_id != char_id))
                {
                    alliance_on_killmails += 1;
                }	
            });
            if(alliance_on_killmails/number_of_killmails > 0.2)
            {
                promises.push(new Promise((resolve) => {
                    $.getJSON(`https://esi.evetech.net/latest/alliances/${alliance_id}/`).then(function(alliance_response){
                        friends_list_html += `<li class="list-group-item"><a target="_blank" data-number=${alliance_on_killmails} href="https://zkillboard.com/alliance/${alliance_id}/">${alliance_response.name}</a> &lt;${alliance_response.ticker}&gt; <span class="font-weight-light">(on ${alliance_on_killmails} killmails)</span> </br></li>`;
                        resolve();
                    });
                }));
            }
        }
    });

    return Promise.all(promises).then(() => {
        $("#right-column-friends").css("display", "block");
        $("#right-column-loading").css("display", "none");
        return friends_list_html;
    });
}

function formAlliancesList(data)
{
    var alliances = [];
    data.forEach(function(killmail){
        killmail.attackers.forEach(function(attacker){
            if(alliances.indexOf(attacker.alliance_id) == -1)
            {
                alliances.push(attacker.alliance_id);
            }
        });
    });
    return alliances;
}

function updateSupersKillsList(html)
{
    $("#super-list").append(html);
    tinysort("#super-list>li", {order: 'desc', selector: 'a', data: 'time'});
}

function formCynoLossesList(data)
{
    var total_cynoes = 0;
    var total_cynoes_recently = 0;
    var today = moment();
    var promises = [];
    var cyno_list_html = "";

    data.forEach(function(killmail){
        var ship = killmail.victim.ship_type_id;
        var rookie_ships = [606, 588, 601, 596];
        if((killmail.victim.items.some(module => (module.item_type_id == 28646 /*covert cyno*/ || module.item_type_id == 21096 /*normal cyno*/) && (module.flag > 26 && module.flag < 35))) && (!rookie_ships.includes(ship)))
        {
            total_cynoes += 1;
            if(today.diff(moment(killmail.killmail_time), 'months') < 3)
            {
                total_cynoes_recently += 1;
            }
            promises.push(new Promise((resolve) => {
                getShipName(ship, function(name){
                    cyno_list_html += `<li><a target="_blank" class="dropdown-item" data-time=${killmail.killmail_time} href="https://zkillboard.com/kill/${killmail.killmail_id}/">${name} @ ${moment(killmail.killmail_time).utc().format('MMMM Do YYYY')}</a></li>`;
                    resolve();
                });
            }));
        }
    });
    var pod_ship_id = [670, 33328];
    var lossmails_recently = data.filter(lossmail => (today.diff(moment(lossmail.killmail_time), 'months') < 3) && (!pod_ship_id.includes(lossmail.victim.ship_type_id))).length;
    $("#cyno-percent-recent").text(`${getPercent(total_cynoes_recently, lossmails_recently)}% recently`);
    $("#cyno-count").text(total_cynoes);
    if(total_cynoes == 0)
    {
        cyno_list_html += `<li class="dropdown-item disabled">No ships with cynoes lost.</li>`;
    }
    $("#cyno-percent").text(`${getPercent(total_cynoes, data.length)}% had cyno`);
    return Promise.all(promises).then(() => {return cyno_list_html;});
}

function updateCynoLossesList(html)
{
    $("#cyno-list").append(html);
    tinysort("#cyno-list>li", {order: 'desc', selector: 'a', data: 'time'});
}

function formSupersKillsList(data)
{
    var supers = [3514, 22852, 23913, 23917, 23919, 42125];
    var titans = [671, 3764, 11567, 23773, 42126, 42241, 45649];
    var killmails_with_supers = 0;
    var killmails_with_supers_recently = 0;
    var today = moment();
    var super_list = $("#super-list");
    var super_list_html = "";
    var promises = [];

    data.forEach(function(killmail){
        if(killmail.attackers.some(x => supers.includes(x.ship_type_id) || titans.includes(x.ship_type_id)))
        {
            killmails_with_supers += 1;
            if(today.diff(moment(killmail.killmail_time), 'months') < 3)
            {
                killmails_with_supers_recently += 1;
            }
            promises.push(new Promise((resolve) =>{
                getShipName(killmail.victim.ship_type_id, function(name){
                    super_list_html += `<li><a target="_blank" class="dropdown-item" data-time=${killmail.killmail_time} href="https://zkillboard.com/kill/${killmail.killmail_id}/">${name} @ ${moment(killmail.killmail_time).utc().format('MMMM Do YYYY')}</a></li>`;
                    resolve();
                });
            }));
        }
    });
    var killmails_recent = data.filter(killmail => today.diff(moment(killmail.killmail_time), 'months') < 3).length;
    $("#supers-percent-recent").text(`${getPercent(killmails_with_supers_recently, killmails_recent)}% recently`);
    $("#supers-percent").text(`${getPercent(killmails_with_supers, data.length)}% had supers or titans`);
    $("#super-count").text(killmails_with_supers);
    if(killmails_with_supers == 0)
    {
        super_list_html = `<li class="dropdown-item disabled">No killmails with supers found.</li>`;
    }
    return Promise.all(promises).then(() => {return super_list_html;});
}


$(document).ready(function(){
    updateChar("Itachi Uchonela");
    $("#strict_checkbox_group").tooltip({title: "Slower search; only use if normal search can't find the character."});
});