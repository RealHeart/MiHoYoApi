import CryptoUtil from '../util/crypto-util'
import http from '../util/http'
import { resultError, resultOK } from './common'

/**
 * @author 真心
 * @date 2021/2/16 19:24
 * @email qgzhenxin@qq.com
 * @description Auth
 */

class Auth {
  static async authKey(type: string, cookies: any) {
    const uid = cookies.account_uid
    const combo_token = cookies.combo_token

    const params: any = {
      app_id: 4,
      channel_id: 1,
      open_id: uid,
      combo_token: combo_token,
      auth_appid: type,
      region: 'cn_gf01',
      ext: ''
    }
    params['sign'] = CryptoUtil.genMiHoYoSign(params)
    params['authkey_ver'] = 1
    params['sign_type'] = 2
    const data: any = await http.post(
      'https://hk4e-sdk.mihoyo.com/hk4e_cn/combo/granter/login/genAuthKey',
      params
    )
    if (data.retcode != 0) {
      return resultError({
        error: data.message,
        error_code: data.retcode
      })
    }
    const authkey = data.data.authkey
    return resultOK({ authkey: authkey })
  }

  static async login(account: string, password: string) {
    let data: any = await http.post(
      'https://hk4e-sdk.mihoyo.com/hk4e_cn/mdk/shield/api/login',
      {
        account: account,
        password: CryptoUtil.getMiHoYoRSAPassword(password),
        is_crypto: true
      }
    )
    if (data.retcode != 0) {
      return resultError({
        error: data.message,
        error_code: data.retcode
      })
    }
    const info = data.data.account
    const token = info.token
    const uid = info.uid
    data = this.comboLogin(uid, token)
    return resultOK({
      account: info,
      combo: data.data,
      cookie: `account_uid=${info.uid}; combo_token=${data.data.combo_token};`
    })
  }

  private static async comboLogin(uid: number, token: string) {
    const paramsData = {
      uid: uid,
      guest: false,
      token: token
    }
    let params: any = {
      app_id: 4,
      channel_id: 1,
      data: JSON.stringify(paramsData),
      device: ''
    }
    params['sign'] = CryptoUtil.genMiHoYoSign(params)
    const data = await http.post(
      'https://hk4e-sdk.mihoyo.com/hk4e_cn/combo/granter/login/v2/login',
      params
    )

    return data
  }

  static async qrcodeFatch(device: string) {
    const data = await http.post(
      'https://hk4e-sdk.mihoyo.com/hk4e_cn/combo/panda/qrcode/fetch',
      { app_id: '4', device }
    )

    if (data.retcode != 0) {
      return resultError({
        error: data.message,
        error_code: data.retcode
      })
    }
    return resultOK({
      url: data.data.url,
      ticket: data.data.url.split('&ticket=')[1],
      device
    })
  }

  static async qrcodeQuery(ticket: string, device: string) {
    const data = await http.post(
      'https://hk4e-sdk.mihoyo.com/hk4e_cn/combo/panda/qrcode/query',
      { app_id: '4', ticket, device }
    )

    if (data.retcode != 0) {
      return resultError({
        error: data.message,
        error_code: data.retcode
      })
    }
    let scanned = false
    let confirmed = false
    let raw = data.data.payload.raw

    if (raw == '') {
      raw = null
    } else {
      try {
        raw = JSON.parse(raw)
      } catch {}
    }
    switch (data.data.stat) {
      case 'Init':
        break
      case 'Scanned':
        scanned = true
        break
      case 'Confirmed':
        confirmed = true
        const result = await this.comboLogin(raw.uid, raw.token)
        raw = {
          uid: raw.uid,
          combo: result.data,
          cookie: `account_uid=${raw.uid}; combo_token=${result.data.combo_token};`
        }
    }

    return resultOK({
      scanned,
      confirmed,
      data: raw
    })
  }
}

export default Auth
