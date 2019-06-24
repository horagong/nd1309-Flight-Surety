
var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {

    var config;
    before('setup contract', async () => {
        config = await Test.Config(accounts);
        await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
    });

    /****************************************************************************************/
    /* Operations and Settings                                                              */
    /****************************************************************************************/

    it(`(multiparty) has correct initial isOperational() value`, async function () {

        // Get operating status
        let status = await config.flightSuretyData.isOperational.call();
        assert.equal(status, true, "Incorrect initial operating status value");

    });

    it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

        // Ensure that access is denied for non-Contract Owner account
        let accessDenied = false;
        try {
            await config.flightSuretyData.setOperatingStatus(false, { from: config.airlines[0] });
        }
        catch (e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, true, "Access not restricted to Contract Owner");

    });

    it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

        // Ensure that access is allowed for Contract Owner account
        let accessDenied = false;
        try {
            await config.flightSuretyData.setOperatingStatus(false, { from: config.owner });
        }
        catch (e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, false, "Access not restricted to Contract Owner");

    });

    it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`,
        async function () {

            await config.flightSuretyData.setOperatingStatus(false);

            let reverted = false;
            try {
                await config.flightSuretyApp.registerAirline(config.airlines[0]);
            }
            catch (e) {
                reverted = true;
            }
            assert.equal(reverted, true, "Access not blocked for requireIsOperational");

            // Set it back for other tests to work
            await config.flightSuretyData.setOperatingStatus(true);

        });

    // REQ: Airline can be registered, but does not participate in contract 
    // until it submits funding of 10 ether
    // Demonstrated either with Truffle test or by making call from client Dapp
    it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {

        // ARRANGE
        let registered = true;
        let funded = true;

        // ACT
        funded = await config.flightSuretyData.airlineFunded.call(config.airlines[0]);

        try {
            await config.flightSuretyApp.registerAirline(config.airlines[0], { from: config.firstAirline });
        }
        catch (e) {
            registered = false;
        }
        //let result = await config.flightSuretyData.isAirline.call(newAirline); 

        // ASSERT
        assert.equal(funded, false,
            "The airline is registered but not funded");
        assert.equal(registered, false,
            "Airline should not be able to register another airline if it hasn't provided funding");

    });

    it('(airline) can fund itself', async () => {

        //ARRANGE
        let before = await config.flightSuretyData.airlineFunded.call(config.firstAirline);

        // ACT
        try {
            await config.flightSuretyApp.fundAirline(config.firstAirline,
                { from: config.firstAirline, value: web3.utils.toWei('10', "ether") });
        }
        catch (e) {
        }

        let result = await config.flightSuretyData.airlineFunded.call(config.firstAirline);

        // ASSERT
        assert.equal(before, false, "The airline is not funded");
        assert.equal(result, true, "Airline can fund itself");

    });

    it('(airline) can be registered using registerAirline() if it is funded', async () => {

        // ARRANGE

        // ACT
        try {
            await config.flightSuretyApp.registerAirline(config.airlines[0], { from: config.firstAirline });
        }
        catch (e) {
            console.log(e);
        }
        let result = await config.flightSuretyData.airlineRegistered.call(config.airlines[0]);
        let count = await config.flightSuretyData.getRegisteredAirlinesCount();

        // ASSERT
        assert.equal(result, true,
            "Airline can be registered using registerAirline() if it is funded");
        assert.equal(count, 2,
            "Registered airlines: firstAirline, this new airline");

    });

    // REQ: Only existing airline may register a new airline 
    // until there are at least four airlines registered
    // Demonstrated either with Truffle test or by making call from client Dapp
    it('Only existing (airline) can register a new airline using registerAirline()\
         until there are at leat four airlines registered it is funded', async () => {

            // ARRANGE

            // ACT
            try {
                await config.flightSuretyApp.registerAirline(config.airlines[1], { from: config.firstAirline });
                await config.flightSuretyApp.registerAirline(config.airlines[2], { from: config.firstAirline });
            }
            catch (e) {
                console.log(e);
            }
            let before = await config.flightSuretyData.getRegisteredAirlinesCount();
            assert.equal(before, 4, ' 4 of registered airlines');
            try {
                await config.flightSuretyApp.registerAirline(config.airlines[3], { from: config.firstAirline });
                await config.flightSuretyApp.registerAirline(config.airlines[4], { from: config.firstAirline });
                await config.flightSuretyApp.registerAirline(config.airlines[5], { from: config.firstAirline });
            }
            catch (e) {
                console.log(e);
            }

            let after = await config.flightSuretyData.getRegisteredAirlinesCount();
            let exist = await config.flightSuretyData.getExistAirlinesCount();
            assert.equal(after, 4, ' 4 of registered airlines when without consensus');
            assert.equal(exist, 7, ' 7 of existing airlines when without consensus');
        });

    // REQ: Registration of fifth and subsequent airlines requires 
    // multi-party consensus of 50% of registered airlines
    // Demonstrated either with Truffle test or by making call from client Dapp

    it('5th (airline) will recieve vogtes utill it get registered', async () => {

        // ARRANGE
        let newAirline = config.airlines[3];

        // ACT
        try {
            await config.flightSuretyApp.fundAirline(config.airlines[0], 
                            { from: config.airlines[0], value: web3.utils.toWei('10', "ether") });
            await config.flightSuretyApp.fundAirline(config.airlines[1], 
                            { from: config.airlines[1], value: web3.utils.toWei('10', "ether") });
            await config.flightSuretyApp.fundAirline(config.airlines[2], 
                            { from: config.airlines[2], value: web3.utils.toWei('10', "ether") });
        }
        catch (e) {
            console.log(e)
        }

        let funded = await config.flightSuretyData.getFundedAirlinesCount();
        assert.equal(funded, 4, ' 4 of funded airlines including firstAirline');

        try {
            await config.flightSuretyApp.voteForAirline(newAirline, { from: config.firstAirline });
            await config.flightSuretyApp.voteForAirline(newAirline, { from: config.airlines[0] });
            await config.flightSuretyApp.voteForAirline(newAirline, { from: config.airlines[1] });
            //await config.flightSuretyApp.voteForAirline(newAirline, { from: config.airlines[2] });
        }
        catch (e) {
            console.log(e)
        }

        let registered = await config.flightSuretyData.airlineRegistered(newAirline);
        // ASSERT
        assert.equal(registered, true, "Voting for airlines will make it registered if pass the needed number");

    });

    it(`passenger can buy insurance for his ticket, event InsuranceBought emited`, async () => {
        await Test.passesWithEvent(
            'InsuranceBought',
            config.flightSuretyData.buyInsurance(
                config.passengers[0],
                config.firstAirline,
                "AD1234",
                1234321212,
                { from: config.passengers[0], value: web3.utils.toWei('0.1', 'ether') })
        );

        let insurance = await config.flightSuretyApp.getInsurance.call(
            config.passengers[0],
            config.firstAirline,
            "AD1234",
            1234321212,
            { from: config.passengers[0] }
        );
        let value = web3.utils.fromWei(insurance.value, 'ether').toString();
        assert.equal(insurance.state, "2", "state of insurance not in bought state")
        assert.equal(value, "0.1", "value of insurance did not match the data in contract");
    });

});
