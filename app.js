const cluster = require('cluster');

if (cluster.isMaster) {
	cluster.fork();
	cluster.on('exit', function(worker, code, signal) {
		cluster.fork();
	});
}

if (cluster.isWorker) {
    const express = require('express');
    const app = express();
    const bodyParser = require('body-parser');
    const axios = require('axios');
    const puppeteer = require('puppeteer');

    var gruphubBearerToken = null;

    require('promise.prototype.finally').shim();
    
    app.use(function (req, res, next) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, content-type');
        res.setHeader('Access-Control-Allow-Credentials', true);
        next();
    });

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({
        extended: true
    }));

    var GetGrubhubBearerToken = async function () {
        console.log("Getting new Grubhub Bearer Token...");
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox']
        });
        const page = await browser.newPage();
        await page.goto("https://www.grubhub.com/search?orderMethod=delivery&locationMode=DELIVERY&facetSet=umamiV2&pageSize=20&hideHateos=true&searchMetrics=true&latitude=38.95862960&longitude=-77.35700226&facet=open_now%3Atrue&sortSetId=umamiV2&sponsoredSize=3&countOmittingTimes=true", {
            waitUntil: "networkidle2"
        });

        await page.setRequestInterception(true);

        page.on("request", req => {
            var keyArr = Object.keys(req.headers());
            var valArr = Object.values(req.headers());
            for (var i = 0; i < keyArr.length; i++) {
                if (keyArr[i] == 'authorization') {
                    gruphubBearerToken = valArr[i];
                    console.log('Updated new Grubhub Bearer Token: ' + gruphubBearerToken);
                    return;
                }
            }
            req.continue();
        });
    }

    GetGrubhubBearerToken();
    setInterval(GetGrubhubBearerToken, 1000 * 60 * 60);

    app.post('/get_nearby_restaurant', function (req, res) {

        if (req.headers.authid == undefined)
            return res.json({
                'status': false, 
                'message': 'Authorization Failed', 
                'restaurants': {}
            });

        if (req.body.lat == '' || req.body.lat == undefined 
            || req.body.lng == '' || req.body.lng == undefined)
            return res.json({
                'status': false, 
                'message': 'Location details are missing in request body.', 
                'restaurants': {}
            });

        if (gruphubBearerToken == null) {
            return res.json({
                'status': false,
                'message': 'Grubhub Authorization Failed. This delay might happen to avoid bot detection. Please try again after 10 seconds.', 
                'restaurants': {}
            });
        }

        var pageNum = (req.body.page == undefined || req.body.page == '') ? 0 : req.body.page;

        var GET_NEARBY_RESTAURANT = 'https://api-gtm.grubhub.com/restaurants/search/search_listing?orderMethod=delivery&locationMode=DELIVERY&facetSet=umamiV2&pageSize=20&hideHateos=true&searchMetrics=true&location=POINT(' + req.body.lng + ' ' + req.body.lat + ')&sortSetId=umamiV2&sponsoredSize=3&countOmittingTimes=true&pageNum=' + pageNum;
        
        axios.get(GET_NEARBY_RESTAURANT, 
            { 
                headers: { 
                    'Authorization': gruphubBearerToken
                } 
            })
            .then(function (response) {
                const restResults = response.data.results;
                var restaurants = [];
                
                for (let i = 0; i < restResults.length; i ++) {
                    restaurants.push({
                        'id': restResults[i].restaurant_id, 
                        'name': restResults[i].name, 
                        'image': restResults[i].logo, 
                        'discount': restResults[i].service_fee.delivery_fee.percent_value, 
                        'rating': restResults[i].ratings.actual_rating_value, 
                        'is_open': restResults[i].open, 
                        'cuisines': restResults[i].cuisines, 
                        'travel_time': restResults[i].delivery_time_estimate, 
                        'price': restResults[i].price_rating, 
                        'discount_type': restResults[i].service_fee.delivery_fee.fee_type, 
                        'target_amount': 0, 
                        'offer_amount': 0, 
                        'is_favourite': 0, 
                        'delivery_type': restResults[i].delivery, 
                        'address': restResults[i].address
                    });
                }

                return res.json({
                    'status': true, 
                    'message': '', 
                    'restaurants': restaurants
                });
            })
            .catch(function (error) {
                console.log('Request Failed. Error: ' + error);
                return res.json({
                    'status': false, 
                    'message': error, 
                    'restaurants': {}
                });
            })
            .finally(function () {
                console.log('Request Finished.');
            });
    });

    app.post('/single_restaurant', function (req, res) {

        if (req.headers.authid == undefined)
            return res.json({
                'status': false, 
                'message': 'Authorization Failed', 
                'restaurant_data': {}
            });

        if (req.body.lat == '' || req.body.lat == undefined 
            || req.body.lng == '' || req.body.lng == undefined)
            return res.json({
                'status': false, 
                'message': 'Location details are missing in request body.', 
                'restaurant_data': {}
            });

        if (req.body.restaurant_id == '' || req.body.restaurant_id == undefined)
            return res.json({
                'status': false, 
                'message': 'Restaurant ID is missing in request body.', 
                'restaurant_data': {}
            });

        if (gruphubBearerToken == null) {
            return res.json({
                'status': false,
                'message': 'Grubhub Authorization Failed. This delay might happen to avoid bot detection. Please try again after 10 seconds.', 
                'restaurant_data': {}
            });
        }

        var GET_SINGLE_RESTAURANT = 'https://api-gtm.grubhub.com/restaurants/' + req.body.restaurant_id + '?hideChoiceCategories=true&version=4&variationId=rtpFreeItems&orderType=standard&hideUnavailableMenuItems=true&hideMenuItems=false&showMenuItemCoupons=true&includePromos=true&location=POINT(' + req.body.lng + '%20' + req.body.lat + ')&locationMode=delivery';
        
        axios.get(GET_SINGLE_RESTAURANT, 
            { 
                headers: { 
                    'Authorization': gruphubBearerToken
                } 
            })
            .then(function (response) {
                return res.json({
                    'status': true,
                    'message': '', 
                    'restaurant_data': {
                        'id': response.data.restaurant.restaurant_id, 
                        'name': response.data.restaurant.name, 
                        'image': response.data.restaurant.logo, 
                        'address': response.data.restaurant.address, 
                        'discount': response.data.restaurant.order_type_settings.service_fee.delivery_fee.percent_value, 
                        'rating': response.data.restaurant.rating.rating_value, 
                        'is_open': true, 
                        'cuisines': response.data.restaurant.cuisines, 
                        'travel_time': response.data.restaurant.just_in_time_orders_transmission_meters, 
                        'price': response.data.restaurant.price_rating, 
                        'discount_type': response.data.restaurant.order_type_settings.service_fee.delivery_fee.fee_type, 
                        'target_amount': 0, 
                        'offer_amount': 0, 
                        'is_favourite': 0, 
                        'delivery_type': response.data.restaurant.managed_delivery, 
                        'shop_description': '', 
                        'fssai_license': '', 
                        'food_list': response.data.restaurant.menu_category_list, 
                        'cart': {}
                    }
                });
            })
            .catch(function (error) {
                console.log('Request Failed. Error: ' + error);
                return res.json({
                    'status': false, 
                    'message': error, 
                    'restaurant_data': {}
                });
            })
            .finally(function () {
                console.log('Request Finished.');
            });
    });

    app.post('/get_food_list', function (req, res) {

        if (req.headers.authid == undefined)
            return res.json({
                'status': false, 
                'message': 'Authorization Failed', 
                'food_list': {}
            });

        if (req.body.lat == '' || req.body.lat == undefined 
            || req.body.lng == '' || req.body.lng == undefined)
            return res.json({
                'status': false, 
                'message': 'Location details are missing in request body.', 
                'food_list': {}
            });

        if (req.body.restaurant_id == '' || req.body.restaurant_id == undefined)
            return res.json({
                'status': false, 
                'message': 'Restaurant ID is missing in request body.', 
                'food_list': {}
            });

        if (gruphubBearerToken == null) {
            return res.json({
                'status': false,
                'message': 'Grubhub Authorization Failed. This delay might happen to avoid bot detection. Please try again after 10 seconds.', 
                'food_list': {}
            });
        }

        var GET_FOOD_LIST = 'https://api-gtm.grubhub.com/restaurants/' + req.body.restaurant_id + '?hideChoiceCategories=true&version=4&variationId=rtpFreeItems&orderType=standard&hideUnavailableMenuItems=true&hideMenuItems=false&showMenuItemCoupons=true&includePromos=true&location=POINT(' + req.body.lng + '%20' + req.body.lat + ')&locationMode=delivery';
        
        axios.get(GET_FOOD_LIST, 
            { 
                headers: { 
                    'Authorization': gruphubBearerToken
                } 
            })
            .then(function (response) {
                return res.json({
                    'status': true,
                    'message': '', 
                    'food_list': response.data.restaurant.menu_category_list
                });
            })
            .catch(function (error) {
                console.log('Request Failed. Error: ' + error);
                return res.json({
                    'status': false, 
                    'message': error, 
                    'food_list': {}
                });
            })
            .finally(function () {
                console.log('Request Finished.');
            });
    });

    const server = app.listen(3200, function () {
        var host = server.address().address;
        var port = server.address().port;
        console.log("Speant - Eatzilla Restaurant API is running at http://%s:%s", host, port)
    });
}