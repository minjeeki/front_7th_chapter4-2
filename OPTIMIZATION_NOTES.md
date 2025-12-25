# 성능 최적화 기록

## 1. API 호출 최적화 - 직렬 실행 문제 해결

### 문제점

기존 코드에서 `Promise.all`을 사용했지만 실제로는 직렬 실행(Sequential Execution)이 발생하고 있음

#### 직렬 실행 vs 병렬 실행

**직렬 실행 (Sequential Execution)**
- 작업들이 하나씩 순차적으로 실행됨
- 이전 작업이 완료된 후 다음 작업이 시작됨
- 총 실행 시간 = 각 작업 시간의 합

```
작업1 완료 → 작업2 시작 → 작업2 완료 → 작업3 시작 → ...
```

**병렬 실행 (Parallel Execution)**
- 여러 작업이 동시에 시작되고 실행됨
- 모든 작업이 함께 실행됨
- 총 실행 시간 = 가장 오래 걸리는 작업의 시간

```
작업1 시작 ┐
작업2 시작 ├─ 동시에 실행
작업3 시작 ┘
```

#### 기존 코드의 문제

```typescript
const fetchAllLectures = async () => await Promise.all([
  (console.log('API Call 1', performance.now()), await fetchMajors()),
  (console.log('API Call 2', performance.now()), await fetchLiberalArts()),
  (console.log('API Call 3', performance.now()), await fetchMajors()),
  (console.log('API Call 4', performance.now()), await fetchLiberalArts()),
  (console.log('API Call 5', performance.now()), await fetchMajors()),
  (console.log('API Call 6', performance.now()), await fetchLiberalArts()),
]);
```

**문제점:**
1. `Promise.all` 내부에서 `await`를 사용하여 직렬 실행됨
   - 배열의 각 요소가 평가될 때 `await`로 인해 완료를 기다림
   - 다음 요소는 이전 요소가 완료된 후에 평가됨

2. 실행 순서가 직렬로 진행됨
   ```
   API Call 1 시작 → 완료 (100ms)
     ↓
   API Call 2 시작 → 완료 (100ms)
     ↓
   API Call 3 시작 → 완료 (100ms)
     ...
   ```
   - 총 소요 시간: 약 600ms (100ms × 6개)

3. 콘솔 로그를 확인하면 시간 간격이 발생
   ```
   API Call 1 100.5
   API Call 2 201.2  ← 100ms 후
   API Call 3 301.8  ← 200ms 후
   API Call 4 402.1  ← 300ms 후
   ...
   ```

4. 중복 API 호출 발생 (별도 단계에서 해결 예정)
   - `fetchMajors()`: 3번 호출
   - `fetchLiberalArts()`: 3번 호출
   - *참고: 중복 호출 문제는 다음 단계에서 캐시 메커니즘을 통해 해결할 예정*

### Promise와 Promise.all 이해하기

#### Promise란?

Promise는 JavaScript에서 비동기 작업의 최종 완료(또는 실패)와 그 결과 값을 나타내는 객체입니다.

```typescript
const promise = fetchMajors();
// fetchMajors()는 즉시 Promise 객체를 반환합니다
// 실제 네트워크 요청은 백그라운드에서 실행됩니다
```

**중요한 개념:**
- Promise 객체는 즉시 생성됩니다 (비동기 작업 시작)
- 실제 비동기 작업(네트워크 요청 등)은 백그라운드에서 실행됩니다
- Promise 객체를 받은 후에도 다른 코드를 계속 실행할 수 있습니다

#### Promise.all이란?

`Promise.all`은 여러 Promise를 받아서 모두 완료될 때까지 기다리는 메서드입니다.

```typescript
Promise.all([promise1, promise2, promise3])
  .then(results => {
    // 모든 Promise가 완료된 후 실행
    // results는 [result1, result2, result3] 형태
  });
```

**동작 원리:**
1. 배열의 각 요소를 평가하여 Promise 객체를 모두 생성
2. 모든 Promise가 시작되고 실행되기를 기다림
3. 모든 Promise가 완료될 때까지 대기
4. 모두 완료되면 결과 배열을 반환

#### await를 사용하면 왜 직렬 실행이 되는가?

```typescript
// ❌ 잘못된 방법 - 직렬 실행
Promise.all([
  await fetchMajors(),      // 1. fetchMajors() 실행
                            // 2. await 때문에 완료될 때까지 대기 (예: 100ms)
                            // 3. 완료 후 다음 요소로 이동
  await fetchLiberalArts(), // 4. 이제 fetchLiberalArts() 실행
                            // 5. await 때문에 완료될 때까지 대기
]);
```

**문제점:**
- 배열의 각 요소가 평가될 때 `await`가 있으면 완료를 기다립니다
- 다음 요소는 이전 요소가 완료된 후에 평가됩니다
- 결과적으로 순차 실행이 됩니다

**실행 순서:**
```
t=0ms:   fetchMajors() 시작
t=100ms: fetchMajors() 완료 → 다음 요소로 이동
t=100ms: fetchLiberalArts() 시작
t=200ms: fetchLiberalArts() 완료
총 시간: 200ms
```

#### await 없이 Promise 객체를 직접 전달하면?

```typescript
// ✅ 올바른 방법 - 병렬 실행
Promise.all([
  fetchMajors(),      // 1. fetchMajors() 호출 → Promise 객체 즉시 반환
                      //    (네트워크 요청은 백그라운드에서 시작됨)
  fetchLiberalArts(), // 2. fetchLiberalArts() 호출 → Promise 객체 즉시 반환
                      //    (네트워크 요청은 백그라운드에서 시작됨)
]);
// 3. Promise.all이 모든 Promise 객체를 받음
// 4. 모든 Promise의 완료를 기다림
```

**동작 원리:**
- 배열의 각 요소가 평가될 때 Promise 객체가 즉시 반환됩니다
- 모든 Promise 객체가 빠르게 생성됩니다 (대기 없음)
- 각 Promise의 네트워크 요청이 백그라운드에서 동시에 진행됩니다
- `Promise.all`은 모든 Promise가 완료될 때까지 기다립니다

**실행 순서:**
```
t=0ms:   fetchMajors() 호출 → Promise 객체 반환 (즉시)
t=0ms:   fetchLiberalArts() 호출 → Promise 객체 반환 (즉시)
t=0ms:   두 네트워크 요청이 백그라운드에서 동시 시작
t=100ms: fetchMajors() 완료
t=100ms: fetchLiberalArts() 완료
t=100ms: Promise.all 완료 (모두 완료)
총 시간: 100ms
```

### 해결 방법

이번 단계에서는 직렬 실행 문제만 해결합니다. `await`를 제거하고 Promise 객체를 직접 전달하여 병렬 실행되도록 수정:

```typescript
const fetchAllLectures = async () => {
  return Promise.all([
    fetchMajors(),        // Promise 객체를 직접 전달 (await 없음)
    fetchLiberalArts(),   
    fetchMajors(),        // 여전히 중복 호출이지만 병렬 실행됨
    fetchLiberalArts(),   
    fetchMajors(),        
    fetchLiberalArts(),   
  ]);
};
```

**실행 순서:**
```
API Call 1 시작 ┐
API Call 2 시작 ├─
API Call 3 시작 ├─
API Call 4 시작 ├─ 모든 호출이 동시에 시작!
API Call 5 시작 ├─
API Call 6 시작 ┘

→ 약 100ms 후 모두 완료
```

**주의사항:**
- 중복 API 호출 문제는 아직 해결되지 않았음 (다음 단계에서 캐시로 해결 예정)
- 하지만 모든 호출이 병렬로 실행되므로 실행 시간은 크게 단축됨

### 개선 효과

#### 실제 측정 결과

**기존 (직렬 실행):**
```
API Call 1: 339.4
API Call 2: 395.2  ← 55.8ms 후 (첫 번째 완료 후 시작)
API Call 3: 403.9  ← 8.7ms 후
API Call 4: 406.9  ← 3ms 후
API Call 5: 409    ← 2.1ms 후
API Call 6: 411.3  ← 2.3ms 후
총 소요 시간: 75.5ms
```
- 첫 번째 API 호출 완료 후 다음 호출이 시작됨 (직렬 실행 확인)

**개선 후 (병렬 실행):**
```
API Call 1: 1173278.6
API Call 2: 1173279.1  ← 0.5ms 후 (거의 동시 시작)
API Call 3: 1173279.5  ← 0.4ms 후 (거의 동시 시작)
API Call 4: 1173279.9  ← 0.4ms 후 (거의 동시 시작)
API Call 5: 1173280.3  ← 0.4ms 후 (거의 동시 시작)
API Call 6: 1173280.6  ← 0.3ms 후 (거의 동시 시작)
총 소요 시간: 70.6ms
```
- 모든 API 호출이 거의 동시에 시작됨 (병렬 실행 확인)
- **약 5ms (6.5%) 성능 개선**

#### 성능 개선이 작게 나타난 이유

1. **로컬 환경의 빠른 응답 속도**
   - 개발 환경에서는 각 API 응답 시간이 10-15ms 정도로 매우 짧음
   - 실제 프로덕션 환경(느린 네트워크, 높은 지연)에서는 차이가 더 클 수 있음

2. **브라우저의 HTTP/2 멀티플렉싱**
   - 같은 도메인에 대한 여러 요청을 브라우저가 어느 정도 병렬 처리
   - 하지만 코드 레벨에서의 직렬 실행은 여전히 비효율적

3. **코드 구조상의 개선**
   - 직렬 실행 → 병렬 실행으로 코드 구조가 올바르게 개선됨
   - 비록 로컬 환경에서는 차이가 작지만, 올바른 패턴으로 작성됨

**참고:**
- 네트워크 요청 수는 아직 6개 (중복 호출 문제 미해결)
- 다음 단계에서 캐시를 통해 네트워크 요청 수를 2개로 줄일 예정
- 실제 네트워크가 느린 환경에서는 병렬 실행의 효과가 더 크게 나타남

### 학습 내용

1. **Promise의 동작 원리**
   - Promise 객체는 즉시 생성됨 (비동기 작업은 백그라운드에서 실행)
   - Promise 객체를 받은 후에도 다른 코드를 계속 실행 가능

2. **Promise.all의 올바른 사용법**
   - `Promise.all`에 Promise 객체를 직접 전달해야 병렬 실행됨
   - 내부에서 `await`를 사용하면 직렬 실행이 됨
   - 배열의 각 요소가 평가될 때 `await`가 있으면 완료를 기다리게 되어 순차 실행됨

3. **await의 역할**
   - `await`는 Promise가 완료될 때까지 함수 실행을 멈춤
   - `Promise.all` 내부에서 `await`를 사용하면 각 요소가 순차적으로 평가됨
   - Promise 객체를 직접 전달하면 모든 Promise가 즉시 생성되어 병렬 실행됨

4. **비동기 처리 최적화**
   - 불필요한 대기 시간 제거
   - 동시 실행을 통한 전체 실행 시간 단축
   - 병렬 실행만으로도 실행 시간을 크게 단축할 수 있음

---

## 2. API 호출 최적화 - 중복 호출 방지 (캐시 메커니즘)

### 문제점

병렬 실행을 구현한 후에도 여전히 같은 API를 여러 번 호출하는 문제가 남아있었습니다.

- `fetchMajors()`: 3번 호출
- `fetchLiberalArts()`: 3번 호출

이로 인해 불필요한 네트워크 요청이 발생하고, 서버 부하와 대역폭 낭비가 발생합니다.

### 클로저란 무엇인가?

**클로저(Closure)**는 함수가 자신이 선언된 렉시컬 스코프를 기억하고 있는 현상입니다.

#### 간단한 예시

```typescript
function outerFunction() {
  const outerVariable = '외부 변수';
  
  function innerFunction() {
    console.log(outerVariable); // 외부 변수에 접근 가능
  }
  
  return innerFunction;
}

const myFunction = outerFunction();
myFunction(); // "외부 변수" 출력 - outerFunction 실행이 끝났는데도 outerVariable에 접근 가능!
```

**클로저의 특징:**
1. 내부 함수가 외부 함수의 변수에 접근할 수 있음
2. 외부 함수가 실행을 마친 후에도 내부 함수가 외부 변수를 기억함
3. 외부에서 직접 접근할 수 없는 private 변수를 만들 수 있음

#### IIFE (Immediately Invoked Function Expression)

IIFE는 함수를 정의함과 동시에 즉시 실행하는 패턴입니다:

```typescript
const myFunction = (() => {
  const privateVariable = '비공개 변수';
  
  return () => {
    console.log(privateVariable); // 클로저로 privateVariable 접근
  };
})();

// privateVariable은 외부에서 접근 불가
// console.log(privateVariable); // 에러!
```

### 클로저를 활용한 캐시 구성

클로저를 사용하여 외부에서 접근할 수 없는 private 캐시를 만들 수 있습니다.

#### 구현 원리

```typescript
const fetchAllLectures = (() => {
  // 1. 이 변수는 외부에서 접근 불가 (private)
  const cache = new Map<string, Promise<AxiosResponse<Lecture[]>>>();
  
  // 2. 내부 함수를 반환 (이 함수가 cache에 접근할 수 있음 = 클로저)
  return async () => {
    // cache는 외부 함수의 변수이지만, 내부 함수에서 접근 가능
    const cached = cache.get('key');
    // ...
  };
})();
```

**작동 방식:**
1. IIFE로 함수를 즉시 실행하여 `cache` Map 생성
2. 외부 함수는 실행을 마치지만, 반환된 함수는 `cache`에 대한 참조를 유지
3. 반환된 함수가 클로저를 형성하여 `cache`에 접근 가능
4. 외부에서는 `cache`에 직접 접근할 수 없음 (캐시 보호)

#### 클로저 캐시의 장점

1. **캡슐화**: 캐시가 외부에 노출되지 않아 안전함
2. **상태 유지**: 함수 호출 간 캐시 상태가 유지됨
3. **메모리 효율**: 필요한 곳에서만 캐시가 유지됨
4. **단순함**: 별도의 클래스나 모듈 없이 간단하게 구현 가능

### 해결 방법: 클로저를 이용한 캐시 메커니즘

클로저를 사용하여 Promise를 캐싱하는 메커니즘을 구현했습니다.

#### 구현 코드

```typescript
const fetchAllLectures = (() => {
  const cache = new Map<string, Promise<AxiosResponse<Lecture[]>>>();
  
  return async () => {
    const majorsKey = 'majors';
    const liberalArtsKey = 'liberal-arts';
    
    // 캐시에 없으면 새로 호출, 있으면 캐시된 Promise 반환
    const majorsPromise = cache.get(majorsKey) || fetchMajors();
    const liberalArtsPromise = cache.get(liberalArtsKey) || fetchLiberalArts();
    
    // 첫 호출인 경우 캐시에 저장
    if (!cache.has(majorsKey)) {
      cache.set(majorsKey, majorsPromise);
    }
    
    if (!cache.has(liberalArtsKey)) {
      cache.set(liberalArtsKey, liberalArtsPromise);
    }
    
    return Promise.all([majorsPromise, liberalArtsPromise]);
  };
})();
```

#### 작동 원리

1. **IIFE (Immediately Invoked Function Expression) 사용**
   - 함수를 즉시 실행하여 클로저 생성
   - `cache` Map이 외부에 노출되지 않고 내부에서만 접근 가능

2. **Promise 재사용**
   - 같은 API를 여러 번 호출해도 캐시된 Promise를 반환
   - 이미 실행 중인 Promise도 재사용 가능
   - 같은 요청에 대해 네트워크 요청을 한 번만 수행

3. **캐시 키 사용**
   - `'majors'`와 `'liberal-arts'`를 키로 사용
   - 각 API에 대해 독립적인 캐시 관리

#### 왜 이 방법이 효과적인가?

**기존 방식 (캐시 없음):**
```typescript
Promise.all([
  fetchMajors(),        // 네트워크 요청 1
  fetchLiberalArts(),   
  fetchMajors(),        // 네트워크 요청 2 (중복!)
  fetchLiberalArts(),   // 네트워크 요청 3 (중복!)
  fetchMajors(),        // 네트워크 요청 4 (중복!)
  fetchLiberalArts(),   // 네트워크 요청 5 (중복!)
]);
// 총 6개의 네트워크 요청
```

**캐시 적용 후:**
```typescript
// 첫 호출
const promise1 = fetchMajors();      // 네트워크 요청 1 (캐시에 저장)
const promise2 = fetchLiberalArts(); // 네트워크 요청 2 (캐시에 저장)

Promise.all([
  promise1,  // 캐시에서 가져옴 (네트워크 요청 없음)
  promise2,  // 캐시에서 가져옴 (네트워크 요청 없음)
  promise1,  // 캐시에서 가져옴 (네트워크 요청 없음)
  promise2,  // 캐시에서 가져옴 (네트워크 요청 없음)
  promise1,  // 캐시에서 가져옴 (네트워크 요청 없음)
  promise2,  // 캐시에서 가져옴 (네트워크 요청 없음)
]);
// 총 2개의 네트워크 요청만 발생
```

### 개선 효과

#### 네트워크 요청 수 감소

- **기존 (캐시 없음):** 6개의 네트워크 요청
- **개선 후 (캐시 적용):** 2개의 네트워크 요청
- **67% 감소**

#### 메모리 효율성

- 이미 실행 중인 Promise를 재사용하므로 메모리 낭비 없음
- 같은 요청에 대해 새로운 Promise 객체를 생성하지 않음

#### 서버 부하 감소

- 서버로 전송되는 HTTP 요청 수가 크게 감소
- 서버의 처리 부하 감소
- 대역폭 사용량 감소

### 학습 내용

1. **클로저를 이용한 캐시 패턴**
   - IIFE를 사용하여 private scope 생성
   - 외부에서 접근할 수 없는 private 변수 (cache Map) 생성
   - 함수 호출 간 상태 유지

2. **Promise 재사용**
   - 같은 요청에 대해 Promise를 재사용
   - 이미 실행 중인 Promise도 재사용 가능
   - 네트워크 요청 최소화

3. **메모리 효율적인 캐싱**
   - Map을 사용한 간단하고 효율적인 캐시 구현
   - 추가 라이브러리 없이 순수 JavaScript로 구현 가능

### 다른 캐시 구현 방식과의 비교

#### 1. React를 활용한 캐시 구현

React에서는 `useRef`나 Context API를 사용하여 캐시를 구현할 수 있습니다.

**useRef를 사용한 방식:**
```typescript
const SearchDialog = () => {
  // useRef는 컴포넌트 인스턴스마다 별도의 ref 생성
  const cacheRef = useRef<Map<string, Promise<AxiosResponse<Lecture[]>>>>(new Map());
  
  const fetchAllLectures = useCallback(async () => {
    const cache = cacheRef.current;
    // cache 사용...
  }, []);
};
```

**차이점:**
- **범위**: 클로저는 함수 스코프, useRef는 컴포넌트 스코프
- **생명주기**: 클로저는 함수가 존재하는 동안, useRef는 컴포넌트가 마운트된 동안
- **React 통합**: useRef는 React 생명주기와 연동, 클로저는 React와 무관
- **공유**: 둘 다 다른 컴포넌트/함수와 공유하지 않음

**내부적으로 클로저를 사용하나?**
- `useRef` 자체는 React 내부에서 클로저를 사용하지 않음
- 하지만 `useCallback`이나 커스텀 훅은 내부적으로 클로저 패턴을 사용할 수 있음
- React의 Fiber 아키텍처 내에서 각 컴포넌트 인스턴스의 상태를 관리하는 방식은 클로저와 유사한 개념

**Context API를 사용한 방식:**
```typescript
const LectureCacheProvider = ({ children }) => {
  const cacheRef = useRef(new Map()); // 여전히 useRef 사용
  
  const getCached = (key, fetcher) => {
    // cacheRef.current에 접근 (클로저가 아님, React의 ref 메커니즘)
    // ...
  };
  
  return (
    <Context.Provider value={{ getCached }}>
      {children}
    </Context.Provider>
  );
};
```

**차이점:**
- **범위**: 전역 (Provider 하위의 모든 컴포넌트)
- **공유**: 여러 컴포넌트에서 공유 가능
- **리렌더링**: 상태를 사용하면 리렌더링 발생 가능

#### 2. TanStack Query와의 비교

**TanStack Query 내부 구현:**

TanStack Query는 내부적으로 클로저와 유사한 패턴을 사용합니다:

```typescript
// TanStack Query 내부 구조 (단순화)
class QueryClient {
  private queryCache: QueryCache; // private 필드 (클래스의 캡슐화)
  
  getQueryCache() {
    return this.queryCache; // 내부 캐시에 접근
  }
}

// useQuery 훅
function useQuery(options) {
  const queryClient = useQueryClient(); // Context에서 가져옴
  
  // queryClient는 클로저처럼 내부 상태에 접근
  const query = queryClient.getQueryCache().find(options.queryKey);
  // ...
}
```

**차이점:**

| 항목 | 클로저 캐시 | TanStack Query |
|------|------------|----------------|
| **내부 구현** | 순수 클로저 (IIFE) | 클래스 + 클로저 조합 |
| **캡슐화** | 함수 스코프 클로저 | 클래스 private 필드 |
| **범위** | 함수 스코프 | 전역 (QueryClient 인스턴스) |
| **캐시 키** | 간단한 문자열 | 복잡한 배열 기반 키 |
| **캐시 만료** | 없음 (수동 관리) | 자동 만료/무효화 |
| **React 통합** | 없음 (순수 JS) | 완전 통합 (훅, Context) |
| **동시 요청 처리** | Promise 재사용 | 전역 중복 제거 |
| **추가 기능** | 없음 | 풍부 (재시도, 리프레시 등) |

**TanStack Query가 클로저를 사용하는가?**

- **부분적으로 사용**: 
  - QueryClient 클래스 내부의 private 필드는 클로저와 유사한 캡슐화 제공
  - `useQuery` 같은 훅은 React의 클로저 메커니즘 활용
  - 하지만 핵심 캐시 구조는 클래스 기반 OOP 패턴 사용
  
- **차이점**:
  - 클로저: 함수 기반, 함수 스코프로 캡슐화
  - TanStack Query: 클래스 기반, private 필드로 캡슐화 + React Context로 전역 상태 관리

#### 3. 각 방식의 적절한 사용 사례

**클로저 캐시가 적합한 경우:**
- 간단한 중복 요청 방지
- 외부 라이브러리 의존성 최소화
- 특정 함수/유틸리티 내부에서만 사용
- 빠른 프로토타이핑

**React useRef 캐시가 적합한 경우:**
- 컴포넌트 내부에서만 사용
- React 생명주기와 통합 필요
- 컴포넌트 마운트 해제 시 캐시도 함께 제거되어야 함

**TanStack Query가 적합한 경우:**
- 복잡한 캐싱 전략 필요
- 여러 컴포넌트에서 데이터 공유
- 캐시 무효화/리프레시 필요
- 프로덕션 수준의 안정성과 기능 필요