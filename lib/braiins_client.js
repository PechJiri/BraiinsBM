'use strict';

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

class BraiinsClient {
    constructor(ip, username, password) {
        this.ip = ip;
        this.username = username;
        this.password = password;
        this.token = null;
        this.clients = {};
        this.initializeClients();
    }

    initializeClients() {
        const PROTO_PATH = {
            auth: path.resolve(__dirname, '../proto/bos/v1/authentication.proto'),
            miner: path.resolve(__dirname, '../proto/bos/v1/miner.proto'),
            performance: path.resolve(__dirname, '../proto/bos/v1/performance.proto'),
            cooling: path.resolve(__dirname, '../proto/bos/v1/cooling.proto'),
            actions: path.resolve(__dirname, '../proto/bos/v1/actions.proto')
        };

        const options = {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true,
            includeDirs: [path.resolve(__dirname, '../proto')]
        };

        // Načtení všech proto definic
        for (const [service, protoPath] of Object.entries(PROTO_PATH)) {
            const packageDefinition = protoLoader.loadSync(protoPath, options);
            const proto = grpc.loadPackageDefinition(packageDefinition);
            
            // Vytvoření příslušného klienta pro každou službu
            const ServiceClass = proto.braiins.bos.v1[this.getServiceName(service)];
            if (ServiceClass) {
                this.clients[service] = new ServiceClass(
                    `${this.ip}:50051`,
                    grpc.credentials.createInsecure()
                );
            }
        }
    }

    getServiceName(service) {
        const serviceNames = {
            auth: 'AuthenticationService',
            miner: 'MinerService',
            performance: 'PerformanceService',
            cooling: 'CoolingService',
            actions: 'ActionsService'
        };
        return serviceNames[service];
    }

    // Autentizace a získání tokenu
    async authenticate() {
        return new Promise((resolve, reject) => {
            this.clients.auth.Login({
                username: this.username,
                password: this.password
            }, (error, response) => {
                if (error) {
                    reject(error);
                    return;
                }
                this.token = response.token;
                resolve(response);
            });
        });
    }

    // Získání metadat s tokenem pro autentizované požadavky
    getAuthMetadata() {
        return new grpc.Metadata().add('authorization', this.token);
    }

    // Získání detailů o mineru
    async getMinerDetails() {
        return new Promise((resolve, reject) => {
            this.clients.miner.GetMinerDetails({}, this.getAuthMetadata(), (error, response) => {
                if (error) reject(error);
                else resolve(response);
            });
        });
    }

    // Získání statistik mineru
    async getMinerStats() {
        return new Promise((resolve, reject) => {
            this.clients.miner.GetMinerStats({}, this.getAuthMetadata(), (error, response) => {
                if (error) reject(error);
                else resolve(response);
            });
        });
    }

    // Získání stavu chlazení
    async getCoolingState() {
        return new Promise((resolve, reject) => {
            this.clients.cooling.GetCoolingState({}, this.getAuthMetadata(), (error, response) => {
                if (error) reject(error);
                else resolve(response);
            });
        });
    }

    // Nastavení výkonového cíle
    async setPowerTarget(powerWatt) {
        return new Promise((resolve, reject) => {
            this.clients.performance.SetPowerTarget({
                save_action: 'SAVE_ACTION_SAVE_AND_APPLY',
                power_target: { watt: powerWatt }
            }, this.getAuthMetadata(), (error, response) => {
                if (error) reject(error);
                else resolve(response);
            });
        });
    }

    // Nastavení hashrate cíle
    async setHashrateTarget(terahashPerSecond) {
        return new Promise((resolve, reject) => {
            this.clients.performance.SetHashrateTarget({
                save_action: 'SAVE_ACTION_SAVE_AND_APPLY',
                hashrate_target: { terahash_per_second: terahashPerSecond }
            }, this.getAuthMetadata(), (error, response) => {
                if (error) reject(error);
                else resolve(response);
            });
        });
    }

    // Získání stavu tuneru
    async getTunerState() {
        return new Promise((resolve, reject) => {
            this.clients.performance.GetTunerState({}, this.getAuthMetadata(), (error, response) => {
                if (error) reject(error);
                else resolve(response);
            });
        });
    }

    // Operace s minerem
    async startMining() {
        return new Promise((resolve, reject) => {
            this.clients.actions.Start({}, this.getAuthMetadata(), (error, response) => {
                if (error) reject(error);
                else resolve(response);
            });
        });
    }

    async stopMining() {
        return new Promise((resolve, reject) => {
            this.clients.actions.Stop({}, this.getAuthMetadata(), (error, response) => {
                if (error) reject(error);
                else resolve(response);
            });
        });
    }
}

module.exports = BraiinsClient;