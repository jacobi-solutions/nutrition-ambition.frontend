//----------------------
// <auto-generated>
//     Generated using the NSwag toolchain v14.2.0.0 (NJsonSchema v11.1.0.0 (Newtonsoft.Json v13.0.0.0)) (http://NSwag.org)
// </auto-generated>
//----------------------

/* tslint:disable */
/* eslint-disable */
// ReSharper disable InconsistentNaming

import { mergeMap as _observableMergeMap, catchError as _observableCatch } from 'rxjs/operators';
import { Observable, throwError as _observableThrow, of as _observableOf } from 'rxjs';
import { Injectable, Inject, Optional, InjectionToken } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse, HttpResponseBase } from '@angular/common/http';

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');

export interface INutritionAmbitionApiService {
    /**
     * @param body (optional) 
     * @return Success
     */
    register(body: AccountRequest | undefined): Observable<Response>;
    /**
     * @param body (optional) 
     * @return Success
     */
    createFoodEntry(body: CreateFoodEntryRequest | undefined): Observable<CreateFoodEntryResponse>;
    /**
     * @param body (optional) 
     * @return Success
     */
    getFoodEntries(body: GetFoodEntriesRequest | undefined): Observable<GetFoodEntriesResponse>;
    /**
     * @param body (optional) 
     * @return Success
     */
    updateFoodEntry(body: UpdateFoodEntryRequest | undefined): Observable<UpdateFoodEntryResponse>;
    /**
     * @param body (optional) 
     * @return Success
     */
    deleteFoodEntry(body: DeleteFoodEntryRequest | undefined): Observable<DeleteFoodEntryResponse>;
}

@Injectable()
export class NutritionAmbitionApiService implements INutritionAmbitionApiService {
    private http: HttpClient;
    private baseUrl: string;
    protected jsonParseReviver: ((key: string, value: any) => any) | undefined = undefined;

    constructor(@Inject(HttpClient) http: HttpClient, @Optional() @Inject(API_BASE_URL) baseUrl?: string) {
        this.http = http;
        this.baseUrl = baseUrl ?? "";
    }

    /**
     * @param body (optional) 
     * @return Success
     */
    register(body: AccountRequest | undefined): Observable<Response> {
        let url_ = this.baseUrl + "/api/Auth/register";
        url_ = url_.replace(/[?&]$/, "");

        const content_ = JSON.stringify(body);

        let options_ : any = {
            body: content_,
            observe: "response",
            responseType: "blob",
            headers: new HttpHeaders({
                "Content-Type": "application/json",
                "Accept": "text/plain"
            })
        };

        return this.http.request("post", url_, options_).pipe(_observableMergeMap((response_ : any) => {
            return this.processRegister(response_);
        })).pipe(_observableCatch((response_: any) => {
            if (response_ instanceof HttpResponseBase) {
                try {
                    return this.processRegister(response_ as any);
                } catch (e) {
                    return _observableThrow(e) as any as Observable<Response>;
                }
            } else
                return _observableThrow(response_) as any as Observable<Response>;
        }));
    }

    protected processRegister(response: HttpResponseBase): Observable<Response> {
        const status = response.status;
        const responseBlob =
            response instanceof HttpResponse ? response.body :
            (response as any).error instanceof Blob ? (response as any).error : undefined;

        let _headers: any = {}; if (response.headers) { for (let key of response.headers.keys()) { _headers[key] = response.headers.get(key); }}
        if (status === 200) {
            return blobToText(responseBlob).pipe(_observableMergeMap(_responseText => {
            let result200: any = null;
            let resultData200 = _responseText === "" ? null : JSON.parse(_responseText, this.jsonParseReviver);
            result200 = Response.fromJS(resultData200);
            return _observableOf(result200);
            }));
        } else if (status !== 200 && status !== 204) {
            return blobToText(responseBlob).pipe(_observableMergeMap(_responseText => {
            return throwException("An unexpected server error occurred.", status, _responseText, _headers);
            }));
        }
        return _observableOf<Response>(null as any);
    }

    /**
     * @param body (optional) 
     * @return Success
     */
    createFoodEntry(body: CreateFoodEntryRequest | undefined): Observable<CreateFoodEntryResponse> {
        let url_ = this.baseUrl + "/api/FoodEntry/CreateFoodEntry";
        url_ = url_.replace(/[?&]$/, "");

        const content_ = JSON.stringify(body);

        let options_ : any = {
            body: content_,
            observe: "response",
            responseType: "blob",
            headers: new HttpHeaders({
                "Content-Type": "application/json",
                "Accept": "text/plain"
            })
        };

        return this.http.request("post", url_, options_).pipe(_observableMergeMap((response_ : any) => {
            return this.processCreateFoodEntry(response_);
        })).pipe(_observableCatch((response_: any) => {
            if (response_ instanceof HttpResponseBase) {
                try {
                    return this.processCreateFoodEntry(response_ as any);
                } catch (e) {
                    return _observableThrow(e) as any as Observable<CreateFoodEntryResponse>;
                }
            } else
                return _observableThrow(response_) as any as Observable<CreateFoodEntryResponse>;
        }));
    }

    protected processCreateFoodEntry(response: HttpResponseBase): Observable<CreateFoodEntryResponse> {
        const status = response.status;
        const responseBlob =
            response instanceof HttpResponse ? response.body :
            (response as any).error instanceof Blob ? (response as any).error : undefined;

        let _headers: any = {}; if (response.headers) { for (let key of response.headers.keys()) { _headers[key] = response.headers.get(key); }}
        if (status === 200) {
            return blobToText(responseBlob).pipe(_observableMergeMap(_responseText => {
            let result200: any = null;
            let resultData200 = _responseText === "" ? null : JSON.parse(_responseText, this.jsonParseReviver);
            result200 = CreateFoodEntryResponse.fromJS(resultData200);
            return _observableOf(result200);
            }));
        } else if (status !== 200 && status !== 204) {
            return blobToText(responseBlob).pipe(_observableMergeMap(_responseText => {
            return throwException("An unexpected server error occurred.", status, _responseText, _headers);
            }));
        }
        return _observableOf<CreateFoodEntryResponse>(null as any);
    }

    /**
     * @param body (optional) 
     * @return Success
     */
    getFoodEntries(body: GetFoodEntriesRequest | undefined): Observable<GetFoodEntriesResponse> {
        let url_ = this.baseUrl + "/api/FoodEntry/GetFoodEntries";
        url_ = url_.replace(/[?&]$/, "");

        const content_ = JSON.stringify(body);

        let options_ : any = {
            body: content_,
            observe: "response",
            responseType: "blob",
            headers: new HttpHeaders({
                "Content-Type": "application/json",
                "Accept": "text/plain"
            })
        };

        return this.http.request("post", url_, options_).pipe(_observableMergeMap((response_ : any) => {
            return this.processGetFoodEntries(response_);
        })).pipe(_observableCatch((response_: any) => {
            if (response_ instanceof HttpResponseBase) {
                try {
                    return this.processGetFoodEntries(response_ as any);
                } catch (e) {
                    return _observableThrow(e) as any as Observable<GetFoodEntriesResponse>;
                }
            } else
                return _observableThrow(response_) as any as Observable<GetFoodEntriesResponse>;
        }));
    }

    protected processGetFoodEntries(response: HttpResponseBase): Observable<GetFoodEntriesResponse> {
        const status = response.status;
        const responseBlob =
            response instanceof HttpResponse ? response.body :
            (response as any).error instanceof Blob ? (response as any).error : undefined;

        let _headers: any = {}; if (response.headers) { for (let key of response.headers.keys()) { _headers[key] = response.headers.get(key); }}
        if (status === 200) {
            return blobToText(responseBlob).pipe(_observableMergeMap(_responseText => {
            let result200: any = null;
            let resultData200 = _responseText === "" ? null : JSON.parse(_responseText, this.jsonParseReviver);
            result200 = GetFoodEntriesResponse.fromJS(resultData200);
            return _observableOf(result200);
            }));
        } else if (status !== 200 && status !== 204) {
            return blobToText(responseBlob).pipe(_observableMergeMap(_responseText => {
            return throwException("An unexpected server error occurred.", status, _responseText, _headers);
            }));
        }
        return _observableOf<GetFoodEntriesResponse>(null as any);
    }

    /**
     * @param body (optional) 
     * @return Success
     */
    updateFoodEntry(body: UpdateFoodEntryRequest | undefined): Observable<UpdateFoodEntryResponse> {
        let url_ = this.baseUrl + "/api/FoodEntry/UpdateFoodEntry";
        url_ = url_.replace(/[?&]$/, "");

        const content_ = JSON.stringify(body);

        let options_ : any = {
            body: content_,
            observe: "response",
            responseType: "blob",
            headers: new HttpHeaders({
                "Content-Type": "application/json",
                "Accept": "text/plain"
            })
        };

        return this.http.request("post", url_, options_).pipe(_observableMergeMap((response_ : any) => {
            return this.processUpdateFoodEntry(response_);
        })).pipe(_observableCatch((response_: any) => {
            if (response_ instanceof HttpResponseBase) {
                try {
                    return this.processUpdateFoodEntry(response_ as any);
                } catch (e) {
                    return _observableThrow(e) as any as Observable<UpdateFoodEntryResponse>;
                }
            } else
                return _observableThrow(response_) as any as Observable<UpdateFoodEntryResponse>;
        }));
    }

    protected processUpdateFoodEntry(response: HttpResponseBase): Observable<UpdateFoodEntryResponse> {
        const status = response.status;
        const responseBlob =
            response instanceof HttpResponse ? response.body :
            (response as any).error instanceof Blob ? (response as any).error : undefined;

        let _headers: any = {}; if (response.headers) { for (let key of response.headers.keys()) { _headers[key] = response.headers.get(key); }}
        if (status === 200) {
            return blobToText(responseBlob).pipe(_observableMergeMap(_responseText => {
            let result200: any = null;
            let resultData200 = _responseText === "" ? null : JSON.parse(_responseText, this.jsonParseReviver);
            result200 = UpdateFoodEntryResponse.fromJS(resultData200);
            return _observableOf(result200);
            }));
        } else if (status !== 200 && status !== 204) {
            return blobToText(responseBlob).pipe(_observableMergeMap(_responseText => {
            return throwException("An unexpected server error occurred.", status, _responseText, _headers);
            }));
        }
        return _observableOf<UpdateFoodEntryResponse>(null as any);
    }

    /**
     * @param body (optional) 
     * @return Success
     */
    deleteFoodEntry(body: DeleteFoodEntryRequest | undefined): Observable<DeleteFoodEntryResponse> {
        let url_ = this.baseUrl + "/api/FoodEntry/DeleteFoodEntry";
        url_ = url_.replace(/[?&]$/, "");

        const content_ = JSON.stringify(body);

        let options_ : any = {
            body: content_,
            observe: "response",
            responseType: "blob",
            headers: new HttpHeaders({
                "Content-Type": "application/json",
                "Accept": "text/plain"
            })
        };

        return this.http.request("post", url_, options_).pipe(_observableMergeMap((response_ : any) => {
            return this.processDeleteFoodEntry(response_);
        })).pipe(_observableCatch((response_: any) => {
            if (response_ instanceof HttpResponseBase) {
                try {
                    return this.processDeleteFoodEntry(response_ as any);
                } catch (e) {
                    return _observableThrow(e) as any as Observable<DeleteFoodEntryResponse>;
                }
            } else
                return _observableThrow(response_) as any as Observable<DeleteFoodEntryResponse>;
        }));
    }

    protected processDeleteFoodEntry(response: HttpResponseBase): Observable<DeleteFoodEntryResponse> {
        const status = response.status;
        const responseBlob =
            response instanceof HttpResponse ? response.body :
            (response as any).error instanceof Blob ? (response as any).error : undefined;

        let _headers: any = {}; if (response.headers) { for (let key of response.headers.keys()) { _headers[key] = response.headers.get(key); }}
        if (status === 200) {
            return blobToText(responseBlob).pipe(_observableMergeMap(_responseText => {
            let result200: any = null;
            let resultData200 = _responseText === "" ? null : JSON.parse(_responseText, this.jsonParseReviver);
            result200 = DeleteFoodEntryResponse.fromJS(resultData200);
            return _observableOf(result200);
            }));
        } else if (status !== 200 && status !== 204) {
            return blobToText(responseBlob).pipe(_observableMergeMap(_responseText => {
            return throwException("An unexpected server error occurred.", status, _responseText, _headers);
            }));
        }
        return _observableOf<DeleteFoodEntryResponse>(null as any);
    }
}

export class AccountRequest implements IAccountRequest {
    username?: string | undefined;
    email?: string | undefined;

    constructor(data?: IAccountRequest) {
        if (data) {
            for (var property in data) {
                if (data.hasOwnProperty(property))
                    (<any>this)[property] = (<any>data)[property];
            }
        }
    }

    init(_data?: any) {
        if (_data) {
            this.username = _data["username"];
            this.email = _data["email"];
        }
    }

    static fromJS(data: any): AccountRequest {
        data = typeof data === 'object' ? data : {};
        let result = new AccountRequest();
        result.init(data);
        return result;
    }

    toJSON(data?: any) {
        data = typeof data === 'object' ? data : {};
        data["username"] = this.username;
        data["email"] = this.email;
        return data;
    }
}

export interface IAccountRequest {
    username?: string | undefined;
    email?: string | undefined;
}

export class CreateFoodEntryRequest implements ICreateFoodEntryRequest {
    description!: string;
    parsedItems?: FoodItem[] | undefined;

    constructor(data?: ICreateFoodEntryRequest) {
        if (data) {
            for (var property in data) {
                if (data.hasOwnProperty(property))
                    (<any>this)[property] = (<any>data)[property];
            }
        }
    }

    init(_data?: any) {
        if (_data) {
            this.description = _data["description"];
            if (Array.isArray(_data["parsedItems"])) {
                this.parsedItems = [] as any;
                for (let item of _data["parsedItems"])
                    this.parsedItems!.push(FoodItem.fromJS(item));
            }
        }
    }

    static fromJS(data: any): CreateFoodEntryRequest {
        data = typeof data === 'object' ? data : {};
        let result = new CreateFoodEntryRequest();
        result.init(data);
        return result;
    }

    toJSON(data?: any) {
        data = typeof data === 'object' ? data : {};
        data["description"] = this.description;
        if (Array.isArray(this.parsedItems)) {
            data["parsedItems"] = [];
            for (let item of this.parsedItems)
                data["parsedItems"].push(item.toJSON());
        }
        return data;
    }
}

export interface ICreateFoodEntryRequest {
    description: string;
    parsedItems?: FoodItem[] | undefined;
}

export class CreateFoodEntryResponse implements ICreateFoodEntryResponse {
    errors?: ErrorDto[] | undefined;
    isSuccess?: boolean;
    correlationId?: string | undefined;
    stackTrace?: string | undefined;
    foodEntry?: FoodEntry;

    constructor(data?: ICreateFoodEntryResponse) {
        if (data) {
            for (var property in data) {
                if (data.hasOwnProperty(property))
                    (<any>this)[property] = (<any>data)[property];
            }
        }
    }

    init(_data?: any) {
        if (_data) {
            if (Array.isArray(_data["errors"])) {
                this.errors = [] as any;
                for (let item of _data["errors"])
                    this.errors!.push(ErrorDto.fromJS(item));
            }
            this.isSuccess = _data["isSuccess"];
            this.correlationId = _data["correlationId"];
            this.stackTrace = _data["stackTrace"];
            this.foodEntry = _data["foodEntry"] ? FoodEntry.fromJS(_data["foodEntry"]) : <any>undefined;
        }
    }

    static fromJS(data: any): CreateFoodEntryResponse {
        data = typeof data === 'object' ? data : {};
        let result = new CreateFoodEntryResponse();
        result.init(data);
        return result;
    }

    toJSON(data?: any) {
        data = typeof data === 'object' ? data : {};
        if (Array.isArray(this.errors)) {
            data["errors"] = [];
            for (let item of this.errors)
                data["errors"].push(item.toJSON());
        }
        data["isSuccess"] = this.isSuccess;
        data["correlationId"] = this.correlationId;
        data["stackTrace"] = this.stackTrace;
        data["foodEntry"] = this.foodEntry ? this.foodEntry.toJSON() : <any>undefined;
        return data;
    }
}

export interface ICreateFoodEntryResponse {
    errors?: ErrorDto[] | undefined;
    isSuccess?: boolean;
    correlationId?: string | undefined;
    stackTrace?: string | undefined;
    foodEntry?: FoodEntry;
}

export class DeleteFoodEntryRequest implements IDeleteFoodEntryRequest {
    foodEntryId!: string;

    constructor(data?: IDeleteFoodEntryRequest) {
        if (data) {
            for (var property in data) {
                if (data.hasOwnProperty(property))
                    (<any>this)[property] = (<any>data)[property];
            }
        }
    }

    init(_data?: any) {
        if (_data) {
            this.foodEntryId = _data["foodEntryId"];
        }
    }

    static fromJS(data: any): DeleteFoodEntryRequest {
        data = typeof data === 'object' ? data : {};
        let result = new DeleteFoodEntryRequest();
        result.init(data);
        return result;
    }

    toJSON(data?: any) {
        data = typeof data === 'object' ? data : {};
        data["foodEntryId"] = this.foodEntryId;
        return data;
    }
}

export interface IDeleteFoodEntryRequest {
    foodEntryId: string;
}

export class DeleteFoodEntryResponse implements IDeleteFoodEntryResponse {
    errors?: ErrorDto[] | undefined;
    isSuccess?: boolean;
    correlationId?: string | undefined;
    stackTrace?: string | undefined;
    success?: boolean;

    constructor(data?: IDeleteFoodEntryResponse) {
        if (data) {
            for (var property in data) {
                if (data.hasOwnProperty(property))
                    (<any>this)[property] = (<any>data)[property];
            }
        }
    }

    init(_data?: any) {
        if (_data) {
            if (Array.isArray(_data["errors"])) {
                this.errors = [] as any;
                for (let item of _data["errors"])
                    this.errors!.push(ErrorDto.fromJS(item));
            }
            this.isSuccess = _data["isSuccess"];
            this.correlationId = _data["correlationId"];
            this.stackTrace = _data["stackTrace"];
            this.success = _data["success"];
        }
    }

    static fromJS(data: any): DeleteFoodEntryResponse {
        data = typeof data === 'object' ? data : {};
        let result = new DeleteFoodEntryResponse();
        result.init(data);
        return result;
    }

    toJSON(data?: any) {
        data = typeof data === 'object' ? data : {};
        if (Array.isArray(this.errors)) {
            data["errors"] = [];
            for (let item of this.errors)
                data["errors"].push(item.toJSON());
        }
        data["isSuccess"] = this.isSuccess;
        data["correlationId"] = this.correlationId;
        data["stackTrace"] = this.stackTrace;
        data["success"] = this.success;
        return data;
    }
}

export interface IDeleteFoodEntryResponse {
    errors?: ErrorDto[] | undefined;
    isSuccess?: boolean;
    correlationId?: string | undefined;
    stackTrace?: string | undefined;
    success?: boolean;
}

export class ErrorDto implements IErrorDto {
    errorMessage?: string | undefined;
    errorCode?: string | undefined;

    constructor(data?: IErrorDto) {
        if (data) {
            for (var property in data) {
                if (data.hasOwnProperty(property))
                    (<any>this)[property] = (<any>data)[property];
            }
        }
    }

    init(_data?: any) {
        if (_data) {
            this.errorMessage = _data["errorMessage"];
            this.errorCode = _data["errorCode"];
        }
    }

    static fromJS(data: any): ErrorDto {
        data = typeof data === 'object' ? data : {};
        let result = new ErrorDto();
        result.init(data);
        return result;
    }

    toJSON(data?: any) {
        data = typeof data === 'object' ? data : {};
        data["errorMessage"] = this.errorMessage;
        data["errorCode"] = this.errorCode;
        return data;
    }
}

export interface IErrorDto {
    errorMessage?: string | undefined;
    errorCode?: string | undefined;
}

export class FoodEntry implements IFoodEntry {
    id?: string | undefined;
    createdDateUtc?: Date;
    lastUpdatedDateUtc?: Date;
    accountId?: string | undefined;
    description?: string | undefined;
    loggedDateUtc?: Date;
    parsedItems?: FoodItem[] | undefined;

    constructor(data?: IFoodEntry) {
        if (data) {
            for (var property in data) {
                if (data.hasOwnProperty(property))
                    (<any>this)[property] = (<any>data)[property];
            }
        }
    }

    init(_data?: any) {
        if (_data) {
            this.id = _data["id"];
            this.createdDateUtc = _data["createdDateUtc"] ? new Date(_data["createdDateUtc"].toString()) : <any>undefined;
            this.lastUpdatedDateUtc = _data["lastUpdatedDateUtc"] ? new Date(_data["lastUpdatedDateUtc"].toString()) : <any>undefined;
            this.accountId = _data["accountId"];
            this.description = _data["description"];
            this.loggedDateUtc = _data["loggedDateUtc"] ? new Date(_data["loggedDateUtc"].toString()) : <any>undefined;
            if (Array.isArray(_data["parsedItems"])) {
                this.parsedItems = [] as any;
                for (let item of _data["parsedItems"])
                    this.parsedItems!.push(FoodItem.fromJS(item));
            }
        }
    }

    static fromJS(data: any): FoodEntry {
        data = typeof data === 'object' ? data : {};
        let result = new FoodEntry();
        result.init(data);
        return result;
    }

    toJSON(data?: any) {
        data = typeof data === 'object' ? data : {};
        data["id"] = this.id;
        data["createdDateUtc"] = this.createdDateUtc ? this.createdDateUtc.toISOString() : <any>undefined;
        data["lastUpdatedDateUtc"] = this.lastUpdatedDateUtc ? this.lastUpdatedDateUtc.toISOString() : <any>undefined;
        data["accountId"] = this.accountId;
        data["description"] = this.description;
        data["loggedDateUtc"] = this.loggedDateUtc ? this.loggedDateUtc.toISOString() : <any>undefined;
        if (Array.isArray(this.parsedItems)) {
            data["parsedItems"] = [];
            for (let item of this.parsedItems)
                data["parsedItems"].push(item.toJSON());
        }
        return data;
    }
}

export interface IFoodEntry {
    id?: string | undefined;
    createdDateUtc?: Date;
    lastUpdatedDateUtc?: Date;
    accountId?: string | undefined;
    description?: string | undefined;
    loggedDateUtc?: Date;
    parsedItems?: FoodItem[] | undefined;
}

export class FoodItem implements IFoodItem {
    name?: string | undefined;
    quantity?: number;
    unit?: string | undefined;
    calories?: number;
    protein?: number;
    carbohydrates?: number;
    fat?: number;
    micronutrients?: { [key: string]: number; } | undefined;

    constructor(data?: IFoodItem) {
        if (data) {
            for (var property in data) {
                if (data.hasOwnProperty(property))
                    (<any>this)[property] = (<any>data)[property];
            }
        }
    }

    init(_data?: any) {
        if (_data) {
            this.name = _data["name"];
            this.quantity = _data["quantity"];
            this.unit = _data["unit"];
            this.calories = _data["calories"];
            this.protein = _data["protein"];
            this.carbohydrates = _data["carbohydrates"];
            this.fat = _data["fat"];
            if (_data["micronutrients"]) {
                this.micronutrients = {} as any;
                for (let key in _data["micronutrients"]) {
                    if (_data["micronutrients"].hasOwnProperty(key))
                        (<any>this.micronutrients)![key] = _data["micronutrients"][key];
                }
            }
        }
    }

    static fromJS(data: any): FoodItem {
        data = typeof data === 'object' ? data : {};
        let result = new FoodItem();
        result.init(data);
        return result;
    }

    toJSON(data?: any) {
        data = typeof data === 'object' ? data : {};
        data["name"] = this.name;
        data["quantity"] = this.quantity;
        data["unit"] = this.unit;
        data["calories"] = this.calories;
        data["protein"] = this.protein;
        data["carbohydrates"] = this.carbohydrates;
        data["fat"] = this.fat;
        if (this.micronutrients) {
            data["micronutrients"] = {};
            for (let key in this.micronutrients) {
                if (this.micronutrients.hasOwnProperty(key))
                    (<any>data["micronutrients"])[key] = (<any>this.micronutrients)[key];
            }
        }
        return data;
    }
}

export interface IFoodItem {
    name?: string | undefined;
    quantity?: number;
    unit?: string | undefined;
    calories?: number;
    protein?: number;
    carbohydrates?: number;
    fat?: number;
    micronutrients?: { [key: string]: number; } | undefined;
}

export class GetFoodEntriesRequest implements IGetFoodEntriesRequest {
    loggedDateUtc?: Date | undefined;

    constructor(data?: IGetFoodEntriesRequest) {
        if (data) {
            for (var property in data) {
                if (data.hasOwnProperty(property))
                    (<any>this)[property] = (<any>data)[property];
            }
        }
    }

    init(_data?: any) {
        if (_data) {
            this.loggedDateUtc = _data["loggedDateUtc"] ? new Date(_data["loggedDateUtc"].toString()) : <any>undefined;
        }
    }

    static fromJS(data: any): GetFoodEntriesRequest {
        data = typeof data === 'object' ? data : {};
        let result = new GetFoodEntriesRequest();
        result.init(data);
        return result;
    }

    toJSON(data?: any) {
        data = typeof data === 'object' ? data : {};
        data["loggedDateUtc"] = this.loggedDateUtc ? this.loggedDateUtc.toISOString() : <any>undefined;
        return data;
    }
}

export interface IGetFoodEntriesRequest {
    loggedDateUtc?: Date | undefined;
}

export class GetFoodEntriesResponse implements IGetFoodEntriesResponse {
    errors?: ErrorDto[] | undefined;
    isSuccess?: boolean;
    correlationId?: string | undefined;
    stackTrace?: string | undefined;
    foodEntries?: FoodEntry[] | undefined;

    constructor(data?: IGetFoodEntriesResponse) {
        if (data) {
            for (var property in data) {
                if (data.hasOwnProperty(property))
                    (<any>this)[property] = (<any>data)[property];
            }
        }
    }

    init(_data?: any) {
        if (_data) {
            if (Array.isArray(_data["errors"])) {
                this.errors = [] as any;
                for (let item of _data["errors"])
                    this.errors!.push(ErrorDto.fromJS(item));
            }
            this.isSuccess = _data["isSuccess"];
            this.correlationId = _data["correlationId"];
            this.stackTrace = _data["stackTrace"];
            if (Array.isArray(_data["foodEntries"])) {
                this.foodEntries = [] as any;
                for (let item of _data["foodEntries"])
                    this.foodEntries!.push(FoodEntry.fromJS(item));
            }
        }
    }

    static fromJS(data: any): GetFoodEntriesResponse {
        data = typeof data === 'object' ? data : {};
        let result = new GetFoodEntriesResponse();
        result.init(data);
        return result;
    }

    toJSON(data?: any) {
        data = typeof data === 'object' ? data : {};
        if (Array.isArray(this.errors)) {
            data["errors"] = [];
            for (let item of this.errors)
                data["errors"].push(item.toJSON());
        }
        data["isSuccess"] = this.isSuccess;
        data["correlationId"] = this.correlationId;
        data["stackTrace"] = this.stackTrace;
        if (Array.isArray(this.foodEntries)) {
            data["foodEntries"] = [];
            for (let item of this.foodEntries)
                data["foodEntries"].push(item.toJSON());
        }
        return data;
    }
}

export interface IGetFoodEntriesResponse {
    errors?: ErrorDto[] | undefined;
    isSuccess?: boolean;
    correlationId?: string | undefined;
    stackTrace?: string | undefined;
    foodEntries?: FoodEntry[] | undefined;
}

export class Response implements IResponse {
    errors?: ErrorDto[] | undefined;
    isSuccess?: boolean;
    correlationId?: string | undefined;
    stackTrace?: string | undefined;

    constructor(data?: IResponse) {
        if (data) {
            for (var property in data) {
                if (data.hasOwnProperty(property))
                    (<any>this)[property] = (<any>data)[property];
            }
        }
    }

    init(_data?: any) {
        if (_data) {
            if (Array.isArray(_data["errors"])) {
                this.errors = [] as any;
                for (let item of _data["errors"])
                    this.errors!.push(ErrorDto.fromJS(item));
            }
            this.isSuccess = _data["isSuccess"];
            this.correlationId = _data["correlationId"];
            this.stackTrace = _data["stackTrace"];
        }
    }

    static fromJS(data: any): Response {
        data = typeof data === 'object' ? data : {};
        let result = new Response();
        result.init(data);
        return result;
    }

    toJSON(data?: any) {
        data = typeof data === 'object' ? data : {};
        if (Array.isArray(this.errors)) {
            data["errors"] = [];
            for (let item of this.errors)
                data["errors"].push(item.toJSON());
        }
        data["isSuccess"] = this.isSuccess;
        data["correlationId"] = this.correlationId;
        data["stackTrace"] = this.stackTrace;
        return data;
    }
}

export interface IResponse {
    errors?: ErrorDto[] | undefined;
    isSuccess?: boolean;
    correlationId?: string | undefined;
    stackTrace?: string | undefined;
}

export class UpdateFoodEntryRequest implements IUpdateFoodEntryRequest {
    foodEntryId!: string;
    description?: string | undefined;
    parsedItems?: FoodItem[] | undefined;

    constructor(data?: IUpdateFoodEntryRequest) {
        if (data) {
            for (var property in data) {
                if (data.hasOwnProperty(property))
                    (<any>this)[property] = (<any>data)[property];
            }
        }
    }

    init(_data?: any) {
        if (_data) {
            this.foodEntryId = _data["foodEntryId"];
            this.description = _data["description"];
            if (Array.isArray(_data["parsedItems"])) {
                this.parsedItems = [] as any;
                for (let item of _data["parsedItems"])
                    this.parsedItems!.push(FoodItem.fromJS(item));
            }
        }
    }

    static fromJS(data: any): UpdateFoodEntryRequest {
        data = typeof data === 'object' ? data : {};
        let result = new UpdateFoodEntryRequest();
        result.init(data);
        return result;
    }

    toJSON(data?: any) {
        data = typeof data === 'object' ? data : {};
        data["foodEntryId"] = this.foodEntryId;
        data["description"] = this.description;
        if (Array.isArray(this.parsedItems)) {
            data["parsedItems"] = [];
            for (let item of this.parsedItems)
                data["parsedItems"].push(item.toJSON());
        }
        return data;
    }
}

export interface IUpdateFoodEntryRequest {
    foodEntryId: string;
    description?: string | undefined;
    parsedItems?: FoodItem[] | undefined;
}

export class UpdateFoodEntryResponse implements IUpdateFoodEntryResponse {
    errors?: ErrorDto[] | undefined;
    isSuccess?: boolean;
    correlationId?: string | undefined;
    stackTrace?: string | undefined;
    updatedEntry?: FoodEntry;

    constructor(data?: IUpdateFoodEntryResponse) {
        if (data) {
            for (var property in data) {
                if (data.hasOwnProperty(property))
                    (<any>this)[property] = (<any>data)[property];
            }
        }
    }

    init(_data?: any) {
        if (_data) {
            if (Array.isArray(_data["errors"])) {
                this.errors = [] as any;
                for (let item of _data["errors"])
                    this.errors!.push(ErrorDto.fromJS(item));
            }
            this.isSuccess = _data["isSuccess"];
            this.correlationId = _data["correlationId"];
            this.stackTrace = _data["stackTrace"];
            this.updatedEntry = _data["updatedEntry"] ? FoodEntry.fromJS(_data["updatedEntry"]) : <any>undefined;
        }
    }

    static fromJS(data: any): UpdateFoodEntryResponse {
        data = typeof data === 'object' ? data : {};
        let result = new UpdateFoodEntryResponse();
        result.init(data);
        return result;
    }

    toJSON(data?: any) {
        data = typeof data === 'object' ? data : {};
        if (Array.isArray(this.errors)) {
            data["errors"] = [];
            for (let item of this.errors)
                data["errors"].push(item.toJSON());
        }
        data["isSuccess"] = this.isSuccess;
        data["correlationId"] = this.correlationId;
        data["stackTrace"] = this.stackTrace;
        data["updatedEntry"] = this.updatedEntry ? this.updatedEntry.toJSON() : <any>undefined;
        return data;
    }
}

export interface IUpdateFoodEntryResponse {
    errors?: ErrorDto[] | undefined;
    isSuccess?: boolean;
    correlationId?: string | undefined;
    stackTrace?: string | undefined;
    updatedEntry?: FoodEntry;
}

export class ApiException extends Error {
    message: string;
    status: number;
    response: string;
    headers: { [key: string]: any; };
    result: any;

    constructor(message: string, status: number, response: string, headers: { [key: string]: any; }, result: any) {
        super();

        this.message = message;
        this.status = status;
        this.response = response;
        this.headers = headers;
        this.result = result;
    }

    protected isApiException = true;

    static isApiException(obj: any): obj is ApiException {
        return obj.isApiException === true;
    }
}

function throwException(message: string, status: number, response: string, headers: { [key: string]: any; }, result?: any): Observable<any> {
    if (result !== null && result !== undefined)
        return _observableThrow(result);
    else
        return _observableThrow(new ApiException(message, status, response, headers, null));
}

function blobToText(blob: any): Observable<string> {
    return new Observable<string>((observer: any) => {
        if (!blob) {
            observer.next("");
            observer.complete();
        } else {
            let reader = new FileReader();
            reader.onload = event => {
                observer.next((event.target as any).result);
                observer.complete();
            };
            reader.readAsText(blob);
        }
    });
}