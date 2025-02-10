'use strict';

const Homey = require('homey');
const { BraiinsClient } = require('../../lib/braiins_client');

class BraiinsMinerDriver extends Homey.Driver {
    async onInit() {
        this.log('BraiinsMinerDriver has been initialized');
    }

    async onPair(session) {
        let settings = {};
        let discoveredDevices = [];

        session.setHandler('getSettings', async () => {
            return settings;
        });

        session.setHandler('settingsChanged', async (data) => {
            settings = data;
        });

        session.setHandler('testConnection', async (data) => {
          try {
              const client = new BraiinsClient(data.ip, data.username, data.password);
              const connected = await client.testConnection();
              
              if (!connected) {
                  throw new Error('Spojení selhalo');
              }
      
              return { success: true };
          } catch (error) {
              return { 
                  success: false, 
                  message: error.message || 'Spojení selhalo'
              };
          }
        });

        session.setHandler('check', async (data) => {
            try {
                const client = new BraiinsClient(data.ip, data.username, data.password);
                await client.testConnection();
                
                const minerDetails = await client.getMinerDetails();
                
                discoveredDevices = [{
                    name: `${minerDetails.miner_identity.name || 'Braiins Miner'} (${minerDetails.hostname || data.ip})`,
                    data: {
                        id: minerDetails.uid || `braiins-${data.ip}`,
                    },
                    settings: {
                        ip_address: data.ip,
                        username: data.username,
                        password: data.password,
                        target_mode: 'power_target',
                        power_target_value: 50,
                        hashrate_target_value: 1
                    }
                }];

                return { success: true };
            } catch (error) {
                return { 
                    success: false, 
                    message: error.message || 'Connection failed' 
                };
            }
        });

        session.setHandler('list_devices', async () => {
            return discoveredDevices;
        });
    }
}

module.exports = BraiinsMinerDriver;
